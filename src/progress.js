/**
 * src/progress.js — Progress UI utilities
 *
 * Wraps ora (spinners) and chalk (colors) for consistent output.
 * In --json mode, suppresses all UI output.
 * In --dry-run mode, only prints the plan.
 */

import ora from 'ora';
import chalk from 'chalk';

let _jsonMode = false;
let _verbose = false;

export function setJsonMode(val) { _jsonMode = val; }
export function setVerbose(val) { _verbose = val; }

/**
 * Create and start a spinner.
 * @param {string} text
 * @returns {{ succeed: function(string), fail: function(string), warn: function(string), update: function(string), stop: function }}
 */
export function spinner(text) {
  if (_jsonMode) {
    // No-op in JSON mode
    return {
      succeed: () => {},
      fail: () => {},
      warn: () => {},
      update: () => {},
      stop: () => {},
    };
  }

  const sp = ora({ text, color: 'cyan' }).start();
  return {
    succeed: (msg) => sp.succeed(msg ?? text),
    fail: (msg) => sp.fail(chalk.red(msg ?? text)),
    warn: (msg) => sp.warn(chalk.yellow(msg ?? text)),
    update: (msg) => { sp.text = msg; },
    stop: () => sp.stop(),
  };
}

/**
 * Print a table of key-value pairs.
 * @param {Record<string, string>} data
 * @param {string} [title]
 */
export function printTable(data, title) {
  if (_jsonMode) return;
  if (title) console.log('\n' + chalk.bold.underline(title));
  const maxKey = Math.max(...Object.keys(data).map((k) => k.length));
  for (const [key, value] of Object.entries(data)) {
    console.log(`  ${chalk.gray(key.padEnd(maxKey + 2))} ${chalk.white(value)}`);
  }
  console.log();
}

/**
 * Print a success summary box.
 * @param {string} title
 * @param {Record<string, string>} items
 */
export function printSummary(title, items) {
  if (_jsonMode) return;
  const width = 60;
  const border = chalk.green('─'.repeat(width));
  console.log('\n' + border);
  console.log(chalk.bold.green(`  ✓ ${title}`));
  console.log(border);
  for (const [key, value] of Object.entries(items)) {
    if (value) {
      console.log(`  ${chalk.gray(key.padEnd(22))} ${chalk.cyan(value)}`);
    }
  }
  console.log(border + '\n');
}

/**
 * Print an error box.
 * @param {string} message
 * @param {string} [hint]
 */
export function printError(message, hint) {
  if (_jsonMode) return;
  console.error(chalk.red('\n✗ Error: ') + message);
  if (hint) console.error(chalk.gray('  Hint: ') + hint);
  console.error();
}

/**
 * Print a warning.
 * @param {string} message
 */
export function printWarning(message) {
  if (_jsonMode) return;
  console.warn(chalk.yellow('⚠ ') + message);
}

/**
 * Verbose-only log.
 * @param {string} message
 */
export function verbose(message) {
  if (_verbose && !_jsonMode) {
    console.log(chalk.gray('[verbose] ') + message);
  }
}

/**
 * Print a section header.
 * @param {string} title
 */
export function section(title) {
  if (_jsonMode) return;
  console.log('\n' + chalk.bold.blue(`▶ ${title}`));
}
