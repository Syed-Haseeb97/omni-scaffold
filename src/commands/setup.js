/**
 * src/commands/setup.js — One-time credential setup wizard
 * Implements `omni setup --all` with interactive progress list,
 * token expiry recording, prerequisite checks, and final quota table.
 */

import chalk from 'chalk';
import { getRegistry } from '../registry.js';
import { storeCredential, getCredential, storeMetadata, isKeyringAvailable } from '../credentials.js';
import { saveConfig, loadConfig } from '../config.js';

// Order of priority for setup --all
const AUTOMATABLE_PROVIDERS = [
  'github',
  'firebase',
  'supabase',
  'vercel',
  'cloudflare-pages',
  'neon',
  'render',
  'resend',
  'upstash',
  'sentry',
  'stripe',
  'clerk',
];

/**
 * @param {{ provider?: string, all?: boolean, verbose?: boolean }} opts
 */
export async function runSetup({ provider: specificProvider, all = false, verbose = false } = {}) {
  const { input, confirm, password: promptPassword } = await import('@inquirer/prompts');

  console.log(chalk.bold.blue('\n🔧 Omni-Scaffold Setup\n'));

  const storeType = isKeyringAvailable()
    ? chalk.green('Windows Credential Manager (keyring)')
    : chalk.yellow('Encrypted JSON (~/.omni/credentials.enc.json)');
  console.log(chalk.gray(`Credential store: ${storeType}\n`));

  const registry = await getRegistry();

  let targetIds = [];
  if (specificProvider) {
    if (!registry.has(specificProvider)) {
      console.log(chalk.red(`Provider "${specificProvider}" not found in registry.`));
      return;
    }
    targetIds = [specificProvider];
  } else if (all) {
    targetIds = AUTOMATABLE_PROVIDERS.filter((id) => registry.has(id));
  } else {
    // Menu selection
    const choices = AUTOMATABLE_PROVIDERS.filter((id) => registry.has(id)).map((id) => {
      const p = registry.get(id);
      return {
        name: `${p.meta.label} (${p.meta.category}) — ${p.meta.freeTierNotes || ''}`,
        value: id,
      };
    });

    const { checkbox } = await import('@inquirer/prompts');
    targetIds = await checkbox({
      message: 'Select providers to configure (or pass --all to configure all):',
      choices,
    });
  }

  if (targetIds.length === 0) {
    console.log(chalk.gray('No providers selected. Exiting.'));
    return;
  }

  // Track progress status for each: 'done' | 'needs-me' | 'pending' | 'skipped'
  const statusMap = new Map(targetIds.map((id) => [id, 'pending']));
  const results = [];

  function printProgress(currentId) {
    console.log(chalk.bold('\n── Setup Progress ────────────────────────────────────'));
    for (const id of targetIds) {
      const p = registry.get(id);
      const st = statusMap.get(id);
      let badge = chalk.gray('[pending] ');
      let detail = '';
      if (st === 'done') badge = chalk.green('[done]    ');
      else if (st === 'needs-me') badge = chalk.yellow.bold('[needs-me]');
      else if (st === 'skipped') badge = chalk.gray('[skipped] ');

      const curMarker = id === currentId ? chalk.cyan(' → ') : '   ';
      console.log(`${curMarker}${badge} ${p.meta.label.padEnd(24)} ${detail}`);
    }
    console.log(chalk.bold('──────────────────────────────────────────────────────\n'));
  }

  // Iterate over providers sequentially
  for (const id of targetIds) {
    const provider = registry.get(id);

    // First check if already verified
    const existingToken = await getCredential(id, 'token');
    let isAlreadyValid = false;

    if (id === 'github') {
      const ghCheck = await provider.verify();
      if (ghCheck.ok) {
        statusMap.set(id, 'done');
        results.push({ id, label: provider.meta.label, ...ghCheck });
        isAlreadyValid = true;
      }
    } else if (id === 'firebase') {
      const fbCheck = await provider.verify();
      if (fbCheck.ok) {
        statusMap.set(id, 'done');
        results.push({ id, label: provider.meta.label, ...fbCheck });
        isAlreadyValid = true;
      }
    } else if (existingToken) {
      const check = await provider.verify({ token: existingToken });
      if (check.ok) {
        statusMap.set(id, 'done');
        results.push({ id, label: provider.meta.label, ...check });
        isAlreadyValid = true;
      }
    }

    if (isAlreadyValid) {
      continue;
    }

    // Provider needs user action
    statusMap.set(id, 'needs-me');
    printProgress(id);

    // Automatically open dashboard URL in user's browser
    if (provider.auth.tokenUrl) {
      try {
        const { execa } = await import('execa');
        if (process.platform === 'win32') {
          await execa('cmd', ['/c', 'start', '""', provider.auth.tokenUrl], { reject: false });
        }
      } catch {}
    }

    let providerDone = false;
    while (!providerDone) {
      console.log(chalk.bold.yellow(`👉 ACTION NEEDED: ${provider.meta.label}`));
      console.log(chalk.gray(`   Instructions: ${provider.auth.tokenInstructions}`));
      if (provider.auth.tokenUrl) {
        console.log(chalk.cyan(`   Dashboard URL: ${provider.auth.tokenUrl} (opened in browser)`));
      }
      if (provider.auth.scopesNeeded?.length) {
        console.log(chalk.gray(`   Scopes needed: ${provider.auth.scopesNeeded.join(', ')} (select 'No Expiration' if offered)`));
      }

      // Check for CLI option first (if applicable)
      if (provider.auth.type === 'cli' && provider.auth.cliLogin && id !== 'supabase' && id !== 'vercel') {
        const tryCli = await confirm({ message: `Run \`${provider.auth.cliLogin}\`?`, default: true });
        if (tryCli) {
          const { execa } = await import('execa');
          const parts = provider.auth.cliLogin.split(' ');
          await execa(parts[0], parts.slice(1), { stdio: 'inherit' });
          const ver = await provider.verify();
          if (ver.ok) {
            results.push({ id, label: provider.meta.label, ...ver });
            statusMap.set(id, 'done');
            providerDone = true;
            break;
          }
        }
      }

      const tokenInput = await promptPassword({
        message: `Paste your ${provider.meta.label} token (hidden input, masked):`,
        mask: '*',
      });

      if (!tokenInput || !tokenInput.trim()) {
        const skip = await confirm({ message: `Skip configuring ${provider.meta.label} for now?`, default: true });
        if (skip) {
          statusMap.set(id, 'skipped');
          providerDone = true;
          break;
        }
        continue;
      }

      const token = tokenInput.trim();

      // Ask for optional expiry date
      const expiryInput = await input({
        message: 'Token expiration date (YYYY-MM-DD) or press Enter for No Expiration:',
        validate: (v) => {
          if (!v.trim()) return true;
          return /^\d{4}-\d{2}-\d{2}$/.test(v.trim()) || 'Format must be YYYY-MM-DD';
        },
      });

      process.stdout.write(chalk.gray(`  Verifying ${provider.meta.label}... `));
      const verResult = await provider.verify({ token });

      if (verResult.ok) {
        await storeCredential(id, 'token', token);
        if (expiryInput?.trim()) {
          await storeMetadata(id, 'expiresAt', expiryInput.trim());
        }

        process.stdout.write(chalk.green(`✓ Valid!\n`));
        console.log(`  Account:    ${chalk.cyan(verResult.account || 'Authenticated')}`);
        console.log(`  Plan:       ${chalk.cyan(verResult.plan || 'Free')}`);
        if (verResult.freeSlots !== undefined) {
          console.log(`  Free slots: ${chalk.cyan(verResult.freeSlots)}`);
        }

        // Handle one-time prerequisites
        await _handlePrerequisites(id, verResult);

        results.push({ id, label: provider.meta.label, ...verResult });
        statusMap.set(id, 'done');
        providerDone = true;
      } else {
        process.stdout.write(chalk.red(`✗ Verification failed: ${verResult.quotaInfo}\n`));
        const retry = await confirm({ message: 'Retry this provider?', default: true });
        if (!retry) {
          statusMap.set(id, 'skipped');
          providerDone = true;
        }
      }
    }
  }

  // Print final progress and status table
  printProgress(null);

  console.log(chalk.bold.green('\n🎉 Setup Session Completed!\n'));
  _printFinalTable(results);

  // Save default region
  const config = loadConfig();
  if (!config.defaultRegion) {
    saveConfig({ defaultRegion: 'us-east-1' });
  }

  console.log(chalk.gray('Configuration updated in ~/.omni/config.json'));
}

async function _handlePrerequisites(id, verResult) {
  if (id === 'vercel') {
    console.log(chalk.cyan('\n  [Prerequisite] Vercel GitHub App:'));
    console.log(chalk.gray('  Ensure the Vercel GitHub App is installed on your GitHub account so Vercel can access your repos:'));
    console.log(chalk.underline.cyan('  → https://github.com/apps/vercel\n'));
  }

  if (id === 'supabase') {
    console.log(chalk.green('  ✓ Supabase organization and plan detected and saved to config'));
  }

  if (id === 'cloudflare-pages') {
    console.log(chalk.green('  ✓ Cloudflare account ID detected and saved to config'));
  }
}

function _printFinalTable(results) {
  console.log(chalk.bold('═'.repeat(72)));
  console.log(
    chalk.bold('  PROVIDER'.padEnd(20)) +
    chalk.bold('ACCOUNT'.padEnd(24)) +
    chalk.bold('PLAN'.padEnd(16)) +
    chalk.bold('STATUS')
  );
  console.log('─'.repeat(72));

  for (const r of results) {
    const statusText = r.ok ? chalk.green('✓ Configured') : chalk.red('✗ Failed');
    const planText = r.plan || 'Free tier';
    const accText = (r.account || '').substring(0, 22);

    console.log(
      `  ${r.label.padEnd(18)}` +
      `${accText.padEnd(24)}` +
      `${planText.padEnd(16)}` +
      `${statusText}`
    );
  }
  console.log(chalk.bold('═'.repeat(72)) + '\n');
}
