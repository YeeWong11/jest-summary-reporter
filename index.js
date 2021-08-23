/* Summary reporter

Intended to be added to the default reporter.
See README.md for installation.
*/
const {relative} = require('path');
const fs = require('fs');
const chalk = require('chalk');
const MARKER_FOR_STATUS = {
  passed: chalk.green('✓'),
  failed: chalk.red('✕'),
  pending: chalk.yellow('○')
}
const fileStyle = chalk.bold.white;
const titleStyle = chalk.grey;
const pathStyle = chalk.white;
const summaryLineStyle = chalk.bold.cyan.underline;
const INDENT = '  ';

class SummaryReporter {
  /**
   * @param {*} globalConfig
   * @param {*} options
   */
  constructor({rootDir}, {failuresOnly=true}={}) {
    this._rootDir = rootDir;
    this._failuresOnly = failuresOnly;
    this._indent = INDENT;
    this._path = [];

    this.resultObj = {
      startTime: new Date().toISOString(),
      ghaCheckRunUrl: process.env.GHA_CHECK_RUN_URL,
      suites: []
    }
  }

  log(message) {
    process.stderr.write(message + '\n');
  }

  onRunComplete(contexts, results) {
    this.log('');
    this.log(summaryLineStyle(this.summaryLine(results)));
    this.log('');
    for (let file of this.sortResults(results.testResults)) {
      if (this._failuresOnly && !file.numFailingTests) continue;
      this.resetPath();
      this.log(fileStyle(relative(this._rootDir, file.testFilePath))); // file path: ui-tests/json.spec.both.ts
      const relativeTestFilePath = relative(this._rootDir, file.testFilePath).replace('ui-tests/', '')

      const suite = {
        suiteName: relativeTestFilePath,
        tests: [],
      }

      // this.resultObj.suites = []
      for (let {status, ancestorTitles, title} of file.testResults) {
        if (this._failuresOnly && status !== 'failed') continue;
        this.printPath(ancestorTitles); // "describe" title
        this.log(`${this._indent}${MARKER_FOR_STATUS[status]||status} ${titleStyle(title)}`);
        suite.tests.push({
          describe: `${title}(${relativeTestFilePath.replace('spec.ts')})`,
          success: status !== 'failed'
        })
      }
      this.resultObj.suites.push(suite)

      console.log('**debug**')
      console.log(JSON.stringify(this.resultObj, null, 2))
      console.log('----------')
      fs.writeFileSync('./testResultJson.json', JSON.stringify(this.resultObj), (err) => {
        if (err) {
          console.warn('jest-summary-reporter: Unable to write test results JSON', err);
        }
      });
    }
    this.log('');
  }

  /** Return copy of input, sorting by filename alphabetically.
   * Sorting ensures the output is stable, needed for snapshot testing.
   */
  sortResults(testResults) {
    let prop = 'testFilePath';
    return testResults.concat().sort((a, b) => a.testFilePath.localeCompare(b.testFilePath));
  }

  summaryLine({numFailedTestSuites, numPassedTests}) {
    if (numFailedTestSuites == 0) {
      return numPassedTests ? 'All tests passed' : 'All tests skipped';
    }
    return this._failuresOnly ? 'Summary of failed tests' : 'Summary of tests';
  }

  printPath(ancestorTitles) {
    let p = this._path, a = ancestorTitles;
    while (p.length > 0 && a.length > 0 && p[p.length-1] != a[a.length-1]) {
      p.pop();
    }
    this._indent = INDENT.repeat(p.length+1);
    for (let i = p.length; i < a.length; i++) {
      this.log(this._indent + pathStyle(a[i]));
      p.push(a[i]);
      this._indent += INDENT;
    }
  }

  resetPath() {
    this._path = [];
    this._indent = INDENT;
  }
}

module.exports = SummaryReporter;
