/**
 * src/commands/destroy.js — Tear down everything Omni created for a project
 */

import chalk from 'chalk';
import { resolve, join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { getRegistry } from '../registry.js';
import { loadState } from '../state.js';
import { loadConfig } from '../config.js';
import { printError, printWarning, spinner } from '../progress.js';

export async function runDestroy(projectNameOrPath, opts = {}) {
  const { yes = false, live = false, verbose = false } = opts;

  let projectDir = resolve(process.cwd());
  let state = loadState(projectDir);

  if (!state || (projectNameOrPath && state.project !== projectNameOrPath)) {
    projectDir = resolve(process.cwd(), projectNameOrPath);
    state = loadState(projectDir);
  }

  if (!state) {
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
    printError(`Could not find project state for "${projectNameOrPath}"`, 'Make sure you specify the correct project name or run from the project root.');
    process.exit(1);
  }

  console.log(chalk.bold.red(`\n🗑️  Destroying project: ${state.project}`));
  console.log(chalk.gray(`   Directory: ${projectDir}\n`));

  if (!live) {
    printWarning('Destroy is running in DRY-RUN mode. Pass --live to execute real teardown.');
  }

  const resources = state.resources || {};
  const activeProviders = Object.keys(resources);

  console.log(chalk.bold('Discovered resources to remove:'));
  for (const [provider, resList] of Object.entries(resources)) {
    console.log(chalk.yellow(`  • ${provider}: ${resList.length} resource(s)`));
    if (verbose) {
      resList.forEach((r) => console.log(chalk.gray(`    - ${JSON.stringify(r)}`)));
    }
  }

  if (activeProviders.length === 0) {
    console.log(chalk.gray('  (No external cloud resources recorded in state.json)'));
  }

  if (!yes) {
    const { confirm } = await import('@inquirer/prompts');
    const ok = await confirm({
      message: chalk.red(`Are you sure you want to permanently delete these resources for "${state.project}"?`),
      default: false,
    });
    if (!ok) {
      console.log(chalk.gray('Teardown cancelled.'));
      return;
    }
  }

  if (!live) {
    console.log(chalk.yellow('\n[Dry-run complete. No resources were deleted.]'));
    return;
  }

  const registry = await getRegistry();
  const cleanupErrors = [];

  for (const providerId of activeProviders.reverse()) {
    const provider = registry.get(providerId);
    const resList = resources[providerId];
    if (!provider) {
      console.warn(chalk.yellow(`Provider plugin "${providerId}" not found in registry. Cannot destroy automatically.`));
      continue;
    }

    const sp = spinner(`Destroying ${provider.meta.label} resources...`);
    try {
      await provider.destroy({ projectDir, projectName: state.project, verbose }, resList);
      sp.succeed(`Cleaned up ${provider.meta.label}`);
    } catch (err) {
      sp.fail(`Failed to destroy ${provider.meta.label}: ${err.message}`);
      cleanupErrors.push({ provider: providerId, error: err.message, resources: resList });
    }
  }

  // Update local registry ~/.omni/projects.json
  try {
    const config = loadConfig();
    if (existsSync(config.projectsFile)) {
      const projects = JSON.parse(readFileSync(config.projectsFile, 'utf8'));
      const updated = projects.filter((p) => p.name !== state.project);
      writeFileSync(config.projectsFile, JSON.stringify(updated, null, 2), 'utf8');
    }
  } catch {}

  if (cleanupErrors.length > 0) {
    console.log(chalk.red('\nSome resources could not be automatically deleted:'));
    for (const item of cleanupErrors) {
      console.log(chalk.bold.red(`  ${item.provider}:`));
      console.log(chalk.gray(`    Error: ${item.error}`));
      console.log(chalk.gray(`    Resources: ${JSON.stringify(item.resources)}`));
    }
  } else {
    console.log(chalk.green(`\n✓ All cloud resources for ${state.project} were successfully torn down.\n`));
  }
}
