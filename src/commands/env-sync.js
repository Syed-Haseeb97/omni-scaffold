/**
 * src/commands/env-sync.js — Sync env vars from state to cloud providers
 */
import chalk from 'chalk';
import { resolve } from 'path';
import { loadState } from '../state.js';
import { getCredential } from '../credentials.js';

export async function runEnvSync(opts = {}) {
  const { live = false, verbose = false, provider: targetProvider, cwd: customCwd } = opts;
  const projectDir = resolve(customCwd || process.cwd());
  const state = loadState(projectDir);

  if (!state) {
    console.log(chalk.red('No .omni/state.json found. Run from your project root.'));
    process.exit(1);
  }

  // Collect all env vars from state outputs
  const env = {};
  for (const step of Object.values(state.steps || {})) {
    if (step.output?.outputs) Object.assign(env, step.output.outputs);
  }

  if (Object.keys(env).length === 0) {
    console.log(chalk.gray('No env vars found in project state.'));
    return;
  }

  console.log(chalk.bold.blue(`\n🔄 Env Sync for ${state.project}\n`));
  console.log(chalk.gray(`${Object.keys(env).length} env var(s) to sync\n`));

  // Sync to Vercel if project has vercel resource
  const vercelResources = state.resources?.vercel || [];
  if ((!targetProvider || targetProvider === 'vercel') && vercelResources.length > 0) {
    const token = await getCredential('vercel', 'token');
    if (!token) {
      console.log(chalk.yellow('⚠  Vercel token not found. Run `omni setup --provider vercel`'));
    } else {
      const projectId = vercelResources[0]?.id;
      if (!live) {
        console.log(chalk.yellow(`[dry-run] Would push ${Object.keys(env).length} env var(s) to Vercel project ${projectId}`));
        Object.keys(env).forEach((k) => console.log(chalk.gray(`  ${k}`)));
      } else {
        const payload = Object.entries(env).map(([key, value]) => ({
          key, value, type: 'encrypted', target: ['production', 'preview', 'development'],
        }));
        const res = await fetch(`https://api.vercel.com/v10/projects/${projectId}/env?upsert=true`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          console.log(chalk.green(`✓ Pushed ${payload.length} env var(s) to Vercel project ${projectId}`));
        } else {
          console.log(chalk.red(`✗ Vercel env sync failed: ${res.status}`));
        }
      }
    }
  }

  if (!live) {
    console.log(chalk.yellow('\nPass --live to actually push env vars.'));
  }
}
