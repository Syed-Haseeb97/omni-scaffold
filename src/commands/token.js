/**
 * src/commands/token.js — Token management (rotate, show-expiry)
 */
import chalk from 'chalk';
import { getRegistry } from '../registry.js';
import { deleteCredential, getMetadata } from '../credentials.js';
import { runSetup } from './setup.js';

export async function runToken(action, providerId, opts = {}) {
  if (action === 'rotate') {
    const registry = await getRegistry();
    if (!registry.has(providerId)) {
      console.log(chalk.red(`Unknown provider: "${providerId}"`));
      console.log(chalk.gray('Available: ' + Array.from(registry.keys()).join(', ')));
      process.exit(1);
    }
    const provider = registry.get(providerId);
    console.log(chalk.bold.blue(`\n🔄 Rotating token for ${provider.meta.label}\n`));
    // Delete old credential then re-run setup
    await deleteCredential(providerId, 'token');
    await runSetup({ provider: providerId, verbose: opts.verbose });
  } else if (action === 'expiry') {
    const registry = await getRegistry();
    const targets = providerId ? [providerId] : Array.from(registry.keys());
    console.log(chalk.bold('\n── Token Expiry Status ──────────────────────────────'));
    for (const id of targets) {
      const expiresAt = await getMetadata(id, 'expiresAt');
      if (!expiresAt) continue;
      const date = new Date(expiresAt);
      const daysLeft = Math.ceil((date.getTime() - Date.now()) / 86400000);
      const color = daysLeft < 0 ? chalk.red : daysLeft <= 7 ? chalk.yellow : chalk.green;
      const p = registry.get(id);
      const label = p?.meta.label ?? id;
      console.log(`  ${color(label.padEnd(24))} expires ${date.toLocaleDateString()} (${daysLeft > 0 ? daysLeft + ' days left' : 'EXPIRED'})`);
    }
    console.log(chalk.bold('─'.repeat(54) + '\n'));
  } else {
    console.log(chalk.red(`Unknown token action: "${action}". Use: rotate, expiry`));
    process.exit(1);
  }
}
