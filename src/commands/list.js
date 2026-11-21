/**
 * src/commands/list.js — List all projects created with omni
 */

import chalk from 'chalk';
import { readFileSync, existsSync } from 'fs';
import { loadConfig } from '../config.js';

export async function runList({ json: jsonMode = false, verbose = false } = {}) {
  const config = loadConfig();
  const projectsFile = config.projectsFile;

  if (!existsSync(projectsFile)) {
    console.log(chalk.gray('No projects created yet. Run `omni create` to get started.'));
    return;
  }

  let projects = [];
  try {
    projects = JSON.parse(readFileSync(projectsFile, 'utf8'));
  } catch (err) {
    console.error(chalk.red(`Failed to read projects file: ${err.message}`));
    return;
  }

  if (jsonMode) {
    console.log(JSON.stringify(projects, null, 2));
    return;
  }

  if (projects.length === 0) {
    console.log(chalk.gray('No projects yet.'));
    return;
  }

  console.log(chalk.bold.blue(`\n📦 Omni-Scaffold Projects (${projects.length})\n`));

  for (const p of projects) {
    console.log(chalk.bold(`  ${p.name}`));
    console.log(chalk.gray(`    Directory: ${p.dir}`));
    if (p.urls?.repo) console.log(chalk.gray(`    Repo:      ${p.urls.repo}`));
    if (p.urls?.live) console.log(chalk.cyan(`    Live URL:  ${p.urls.live}`));
    if (p.createdAt) console.log(chalk.gray(`    Created:   ${new Date(p.createdAt).toLocaleDateString()}`));
    console.log();
  }
}
