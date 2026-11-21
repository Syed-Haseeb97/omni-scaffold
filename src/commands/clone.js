/**
 * src/commands/clone.js — Clone an existing project's stack config into a new project
 */
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { loadConfig } from '../config.js';
import { loadState } from '../state.js';
import { runCreate } from './create.js';
import { resolve } from 'path';

export async function runClone(sourceProjectName, opts = {}) {
  const { name: newName, live = false, yes = false, verbose = false } = opts;

  // Find source project
  const config = loadConfig();
  let sourceState = null;
  let sourceDir = null;

  if (existsSync(config.projectsFile)) {
    const projects = JSON.parse(readFileSync(config.projectsFile, 'utf8'));
    const found = projects.find((p) => p.name === sourceProjectName);
    if (found) {
      sourceDir = found.dir;
      sourceState = loadState(found.dir);
    }
  }

  if (!sourceState) {
    sourceDir = resolve(process.cwd(), sourceProjectName);
    sourceState = loadState(sourceDir);
  }

  if (!sourceState) {
    console.log(chalk.red(`Could not find project "${sourceProjectName}".`));
    console.log(chalk.gray('Use `omni list` to see available projects.'));
    process.exit(1);
  }

  console.log(chalk.bold.blue(`\n📋 Cloning stack from "${sourceProjectName}"\n`));
  console.log(chalk.gray('Stack:'));
  for (const [cat, ids] of Object.entries(sourceState.plan?.selectedProviders || {})) {
    console.log(chalk.gray(`  ${cat}: ${ids.join(', ')}`));
  }

  const { input } = await import('@inquirer/prompts');
  const targetName = newName || await input({
    message: 'New project name:',
    validate: (v) => /^[a-z0-9-]+$/.test(v.trim()) || 'Use lowercase letters, numbers, hyphens',
  });

  // Build pre-config from source state
  const preConfig = {
    ...(sourceState.plan?.selectedProviders || {}),
    answers: sourceState.plan?.answers || {},
  };

  await runCreate({
    name: targetName,
    config: null,
    live,
    yes,
    verbose,
    preConfigObj: preConfig, // pass directly
  });
}
