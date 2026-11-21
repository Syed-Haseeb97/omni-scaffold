/**
 * src/commands/doctor.js — Verify all credentials and show health status
 */

import chalk from 'chalk';
import { getRegistry } from '../registry.js';
import { getCredential, getMetadata } from '../credentials.js';

/**
 * @param {{ verbose?: boolean }} opts
 */
export async function runDoctor({ verbose = false } = {}) {
  const registry = await getRegistry();

  console.log(chalk.bold.blue('\n🔍 Omni-Scaffold Doctor\n'));
  console.log(chalk.gray(`Checking ${registry.size} provider(s)...\n`));

  const results = [];
  const authNone = [];

  for (const [id, provider] of registry) {
    if (provider.auth.type === 'none') {
      authNone.push({ id, label: provider.meta.label, category: provider.meta.category });
      continue;
    }

    const sp = process.stdout;
    process.stdout.write(chalk.gray(`  Checking ${provider.meta.label}... `));

    try {
      // Build creds object from stored credential
      const creds = {};
      if (provider.auth.envVar) {
        const stored = await getCredential(id, 'token');
        const envVal = process.env[provider.auth.envVar];
        if (stored) creds.token = stored;
        else if (envVal) creds.token = envVal;
      }

      const result = await provider.verify(creds);
      
      // Check token expiry
      const expiresAtStr = await getMetadata(id, 'expiresAt');
      if (expiresAtStr) {
        const expiresAt = new Date(expiresAtStr);
        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 7 && daysLeft >= 0) {
          result.quotaInfo = (result.quotaInfo ? result.quotaInfo + ' | ' : '') + `⚠ Token expires in ${daysLeft} day(s) (${expiresAt.toLocaleDateString()}). Run omni setup --provider ${id} to renew.`;
        } else if (daysLeft < 0) {
          result.ok = false;
          result.quotaInfo = `❌ Token expired on ${expiresAt.toLocaleDateString()}. Run omni setup --provider ${id} to renew.`;
        }
      }

      results.push({ id, label: provider.meta.label, category: provider.meta.category, ...result });

      if (result.ok) {
        process.stdout.write(chalk.green(`✓ ${result.account}\n`));
        if (verbose && result.quotaInfo) {
          console.log(chalk.gray(`    ${result.quotaInfo}`));
        }
      } else {
        process.stdout.write(chalk.red(`✗ ${result.quotaInfo}\n`));
      }
    } catch (err) {
      process.stdout.write(chalk.red(`✗ Error: ${err.message}\n`));
      results.push({ id, label: provider.meta.label, category: provider.meta.category, ok: false, account: null, quotaInfo: err.message });
    }
  }

  // Summary
  console.log('\n' + chalk.bold('─'.repeat(60)));
  const ok = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok).length;
  const skipped = authNone.length;

  console.log(
    chalk.green(`✓ ${ok} provider(s) authenticated`) +
      (failed > 0 ? chalk.red(`  ✗ ${failed} not configured`) : '') +
      (skipped > 0 ? chalk.gray(`  ○ ${skipped} no auth required`) : '')
  );

  if (failed > 0) {
    console.log(chalk.yellow('\nRun `omni setup` to configure missing providers.\n'));
  } else {
    console.log(chalk.green('\nAll configured providers are healthy! ✓\n'));
  }

  // Quota warnings
  const warnings = results.filter((r) => r.ok && r.quotaInfo && r.quotaInfo.includes('⚠'));
  if (warnings.length > 0) {
    console.log(chalk.yellow('⚠  Quota warnings:'));
    for (const w of warnings) {
      console.log(chalk.yellow(`  ${w.label}: ${w.quotaInfo}`));
    }
    console.log();
  }

  return { results, skipped: authNone };
}
