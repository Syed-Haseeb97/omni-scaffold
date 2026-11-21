/**
 * src/commands/status.js — Show project DAG step status
 */
import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadState } from '../state.js';
import { loadConfig } from '../config.js';

const STATUS_ICONS = {
  DONE:    chalk.green('✓ DONE   '),
  RUNNING: chalk.blue('⟳ RUNNING'),
  FAILED:  chalk.red('✗ FAILED '),
  SKIPPED: chalk.gray('- SKIPPED'),
  PENDING: chalk.gray('○ PENDING'),
};

export async function runStatus(projectNameOrPath, opts = {}) {
  let projectDir = resolve(process.cwd());
  let state = loadState(projectDir);

  if (!state || (projectNameOrPath && state.project !== projectNameOrPath)) {
    projectDir = resolve(process.cwd(), projectNameOrPath || '');
    state = loadState(projectDir);
  }

  // Also try global projects.json
  if (!state && projectNameOrPath) {
    const config = loadConfig();
    if (existsSync(config.projectsFile)) {
      try {
        const projects = JSON.parse(readFileSync(config.projectsFile, 'utf8'));
        const found = projects.find((p) => p.name === projectNameOrPath);
        if (found && existsSync(found.dir)) {
          projectDir = found.dir;
          state = loadState(projectDir);
        }
      } catch {}
    }
  }

  if (!state) {
    console.log(chalk.red(`No project state found for "${projectNameOrPath || 'current directory'}"`));
    console.log(chalk.gray('Run from an omni-scaffolded project root, or pass a project name.'));
    process.exit(1);
  }

  console.log(chalk.bold.blue(`\n📊 Project Status: ${state.project}\n`));
  console.log(chalk.gray(`Directory: ${projectDir}`));
  console.log(chalk.gray(`Created:   ${new Date(state.createdAt).toLocaleString()}`));
  console.log(chalk.gray(`Updated:   ${new Date(state.updatedAt).toLocaleString()}\n`));

  const steps = Object.entries(state.steps || {});
  if (steps.length === 0) {
    console.log(chalk.gray('No steps recorded yet.'));
    return;
  }

  console.log(chalk.bold('── Step Status ' + '─'.repeat(50)));
  for (const [stepId, step] of steps) {
    const icon = STATUS_ICONS[step.status] || chalk.gray(step.status.padEnd(9));
    const duration = step.startedAt && step.completedAt
      ? chalk.gray(` (${((new Date(step.completedAt) - new Date(step.startedAt)) / 1000).toFixed(1)}s)`)
      : '';
    console.log(`  ${icon}  ${stepId.padEnd(30)}${duration}`);
    if (step.status === 'FAILED' && step.error) {
      console.log(chalk.red(`    Error: ${step.error}`));
    }
    if (opts.verbose && step.output && Object.keys(step.output).length > 0) {
      for (const [k, v] of Object.entries(step.output)) {
        if (typeof v === 'string' && /^[A-Z][A-Z0-9_]+$/.test(k)) {
          console.log(chalk.gray(`    ${k}=${v.substring(0, 60)}${v.length > 60 ? '...' : ''}`));
        }
      }
    }
  }

  const done = steps.filter(([, s]) => s.status === 'DONE').length;
  const failed = steps.filter(([, s]) => s.status === 'FAILED').length;
  const running = steps.filter(([, s]) => s.status === 'RUNNING').length;

  console.log(chalk.bold('─'.repeat(60)));
  console.log(
    chalk.green(`✓ ${done} done`) +
    (failed > 0 ? chalk.red(`  ✗ ${failed} failed`) : '') +
    (running > 0 ? chalk.blue(`  ⟳ ${running} running`) : '')
  );

  if (failed > 0) {
    console.log(chalk.yellow('\nResume with: omni create --resume'));
    console.log(chalk.yellow('Roll back with: omni destroy ' + state.project + ' --live'));
  }
  console.log();
}
