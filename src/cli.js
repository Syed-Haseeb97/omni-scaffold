#!/usr/bin/env node
/**
 * src/cli.js — Omni-Scaffold CLI entry point
 * Uses commander for subcommand routing. All commands are ESM modules.
 */

import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));

program
  .name('omni')
  .description('One command to scaffold a full-stack app')
  .version(pkg.version)
  .option('--verbose', 'Enable verbose logging')
  .option('--no-color', 'Disable color output');

// ── setup ─────────────────────────────────────────────────────────────────────
program
  .command('setup')
  .description('One-time wizard: connect your cloud accounts')
  .option('--provider <id>', 'Set up only a specific provider')
  .option('--all', 'Configure all automatable providers sequentially in one session')
  .action(async (opts) => {
    const { runSetup } = await import('./commands/setup.js');
    await runSetup({ ...opts, verbose: program.opts().verbose });
  });

// ── doctor ────────────────────────────────────────────────────────────────────
program
  .command('doctor')
  .description('Verify all stored credentials and show account info')
  .action(async () => {
    const { runDoctor } = await import('./commands/doctor.js');
    await runDoctor({ verbose: program.opts().verbose });
  });

// ── create ────────────────────────────────────────────────────────────────────
program
  .command('create')
  .description('Create a new full-stack project')
  .option('--name <name>', 'Project name (skips prompt)')
  .option('--dry-run', 'Print the plan without making any real changes')
  .option('--yes', 'Skip confirmation prompts')
  .option('--config <file>', 'Load answers from a JSON config file')
  .option('--json', 'Output machine-readable JSON (for agents)')
  .option('--prompt <text>', 'AI-generate starter code from a description (Phase 2)')
  .option('--resume', 'Resume a previously interrupted create')
  .option('--sequential', 'Run steps one at a time (for debugging)')
  .option('--live', 'Allow real API calls (required for provisioning)')
  .action(async (opts) => {
    const { runCreate } = await import('./commands/create.js');
    await runCreate({ ...opts, verbose: program.opts().verbose });
  });

// ── add ───────────────────────────────────────────────────────────────────────
program
  .command('add <provider>')
  .description('Add a service to an existing project')
  .option('--dry-run', 'Print the plan without making real changes')
  .option('--live', 'Allow real API calls')
  .action(async (provider, opts) => {
    const { runAdd } = await import('./commands/add.js');
    await runAdd(provider, { ...opts, verbose: program.opts().verbose });
  });

// ── list ──────────────────────────────────────────────────────────────────────
program
  .command('list')
  .description('List projects created with omni')
  .option('--json', 'Output as JSON')
  .action(async (opts) => {
    const { runList } = await import('./commands/list.js');
    await runList({ ...opts, verbose: program.opts().verbose });
  });

// ── destroy ───────────────────────────────────────────────────────────────────
program
  .command('destroy <project>')
  .description('Tear down everything Omni created for a project')
  .option('--yes', 'Skip confirmation prompts')
  .option('--live', 'Allow real destructive API calls')
  .action(async (project, opts) => {
    const { runDestroy } = await import('./commands/destroy.js');
    await runDestroy(project, { ...opts, verbose: program.opts().verbose });
  });

// ── mcp ───────────────────────────────────────────────────────────────────────
program
  .command('mcp')
  .description('Run Omni as an MCP server over stdio (for Antigravity/agents)')
  .action(async () => {
    const { runMcp } = await import('./commands/mcp.js');
    await runMcp();
  });

// ── status ────────────────────────────────────────────────────────────────────
program
  .command('status [project]')
  .description('Show step-by-step DAG execution status for a project')
  .option('--verbose', 'Show output env vars per step')
  .action(async (project, opts) => {
    const { runStatus } = await import('./commands/status.js');
    await runStatus(project, { ...opts, verbose: program.opts().verbose || opts.verbose });
  });

// ── token ──────────────────────────────────────────────────────────────────────
program
  .command('token <action> [provider]')
  .description('Manage stored tokens. Actions: rotate, expiry')
  .action(async (action, provider, opts) => {
    const { runToken } = await import('./commands/token.js');
    await runToken(action, provider, { verbose: program.opts().verbose });
  });

// ── clone ──────────────────────────────────────────────────────────────────────
program
  .command('clone <source-project>')
  .description('Clone a project\'s stack config into a new project')
  .option('--name <name>', 'New project name (skips prompt)')
  .option('--live', 'Allow real API calls')
  .option('--yes', 'Skip confirmations')
  .action(async (source, opts) => {
    const { runClone } = await import('./commands/clone.js');
    await runClone(source, { ...opts, verbose: program.opts().verbose });
  });

// ── env-sync ──────────────────────────────────────────────────────────────────
program
  .command('env-sync')
  .description('Sync env vars from .omni/state.json to cloud provider dashboards')
  .option('--live', 'Actually push env vars (default: dry-run)')
  .option('--provider <id>', 'Only sync to a specific provider (e.g. vercel)')
  .action(async (opts) => {
    const { runEnvSync } = await import('./commands/env-sync.js');
    await runEnvSync({ ...opts, verbose: program.opts().verbose });
  });

program.parse();
