/**
 * src/commands/add.js — Add a service to an existing project
 */

import chalk from 'chalk';
import { resolve } from 'path';
import { existsSync, appendFileSync, readFileSync } from 'fs';
import { getProvider, getRegistry } from '../registry.js';
import { loadState, updateStep, recordResources } from '../state.js';
import { spinner, printSummary, printError, printWarning, section, setVerbose, setJsonMode } from '../progress.js';
import { _normalizeOutput } from './create.js';

export async function runAdd(providerId, opts = {}) {
  const { dryRun = false, live = false, verbose = false } = opts;
  setVerbose(verbose);

  const projectDir = process.cwd();
  const state = loadState(projectDir);

  if (!state) {
    printError('No .omni/state.json found in the current directory.', 'Run this command from the root of an omni-scaffolded project, or run `omni create`.');
    process.exit(1);
  }

  let provider;
  try {
    provider = await getProvider(providerId);
  } catch (err) {
    printError(`Unknown provider: ${providerId}`);
    const reg = await getRegistry();
    console.log(chalk.gray('Available providers: ' + Array.from(reg.keys()).join(', ')));
    process.exit(1);
  }

  console.log(chalk.bold.blue(`\n➕ Adding ${provider.meta.label} to ${state.project}\n`));

  let answers = {};
  if (provider.questions) {
    answers = await provider.questions({ projectName: state.project, projectDir });
  }

  if (provider.auth.type !== 'none' && live && !dryRun) {
    const credCheck = await provider.verify();
    if (!credCheck.ok) {
      printWarning(`${provider.meta.label} verification failed: ${credCheck.quotaInfo}`);
      const { confirm } = await import('@inquirer/prompts');
      const doSetup = await confirm({ message: `Configure credentials for ${provider.meta.label} now?`, default: true });
      if (doSetup) {
        const { runSetup } = await import('./setup.js');
        await runSetup({ provider: providerId, verbose });
      }
    }
  }

  const ctx = {
    projectName: state.project,
    projectDir,
    answers: { [providerId]: answers },
    outputs: {},
    dryRun: dryRun || !live,
    verbose,
  };

  if (dryRun || !live) {
    printWarning('Running in dry-run mode (pass --live to make real changes).');
    const dryResult = await provider.provision(ctx);
    if (dryResult.dryRunPlan) {
      console.log(chalk.bold('\nPlanned Actions:'));
      dryResult.dryRunPlan.forEach((p) => console.log(chalk.cyan(`  - ${p}`)));
    }
    return;
  }

  const sp = spinner(`Provisioning ${provider.meta.label}...`);
  try {
    const result = await provider.provision(ctx);
    sp.succeed(`${provider.meta.label} provisioned successfully!`);

    const normalizedResult = _normalizeOutput(result);

    updateStep(projectDir, state, `add-${providerId}`, {
      status: 'DONE',
      completedAt: new Date().toISOString(),
      output: normalizedResult.outputs || {},
    });

    if (normalizedResult.resources?.length) {
      recordResources(projectDir, state, providerId, normalizedResult.resources);
    }

    if (normalizedResult.outputs && Object.keys(normalizedResult.outputs).length > 0) {
      const envPath = resolve(projectDir, '.env.local');
      const lines = Object.entries(normalizedResult.outputs)
        .map(([k, v]) => `${k}=${v}`)
        .join('\n');
      appendFileSync(envPath, `\n# Added via omni add ${providerId}\n${lines}\n`, 'utf8');
      console.log(chalk.green(`  ✓ Updated .env.local with new variables`));
    }

    printSummary(`Added ${provider.meta.label}`, {
      ...normalizedResult.outputs,
      ...normalizedResult.urls,
    });
  } catch (err) {
    sp.fail(`Failed to add ${provider.meta.label}: ${err.message}`);
    updateStep(projectDir, state, `add-${providerId}`, {
      status: 'FAILED',
      completedAt: new Date().toISOString(),
      error: err.message,
    });
  }
}
