/**
 * src/providers/hosting-frontend/cloudflare-pages.js — Cloudflare Pages via wrangler CLI
 *
 * Uses wrangler CLI for all operations (most reliable approach on Windows).
 * API Docs: https://developers.cloudflare.com/pages/
 * Date checked: 2026-11-09
 */

import { execa } from 'execa';
import { getCredential } from '../../credentials.js';

export const meta = {
  id: 'cloudflare-pages',
  label: 'Cloudflare Pages',
  category: 'hosting-frontend',
  freeTierNotes: 'Free: unlimited sites, 500 builds/month, unlimited bandwidth',
  docsUrl: 'https://developers.cloudflare.com/pages/',
};

export const auth = {
  type: 'cli',
  envVar: 'CLOUDFLARE_API_TOKEN',
  cliLogin: 'wrangler login',
  tokenUrl: 'https://dash.cloudflare.com/profile/api-tokens',
  tokenInstructions: 'Create a token with Cloudflare Pages:Edit + Account Settings:Read',
  scopesNeeded: ['Cloudflare Pages:Edit'],
};

async function checkWrangler() {
  try {
    await execa('wrangler', ['--version'], { reject: false });
    return true;
  } catch {
    return false;
  }
}

export async function verify(creds = {}) {
  const token = creds.token || (await getCredential('cloudflare', 'token')) || process.env.CLOUDFLARE_API_TOKEN;

  // 1. Try REST API verification directly if token is available
  if (token) {
    try {
      const res = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.result?.status === 'active') {
        // Also fetch account ID
        let accountName = 'Cloudflare Account';
        try {
          const accRes = await fetch('https://api.cloudflare.com/client/v4/accounts', {
            headers: { Authorization: `Bearer ${token}` },
          });
          const accData = await accRes.json();
          if (accData.success && accData.result?.length > 0) {
            const acc = accData.result[0];
            accountName = acc.name;
            const { saveConfig } = await import('../../config.js');
            saveConfig({ cloudflareAccountId: acc.id });
          }
        } catch {}

        return {
          ok: true,
          account: accountName,
          plan: 'Free (unlimited sites, 500 builds/mo)',
          freeSlots: '500 builds/month',
          quotaInfo: 'Unlimited bandwidth & sites, 500 builds/month',
        };
      }
    } catch {}
  }

  // 2. Fallback to wrangler CLI / npx
  try {
    const { stdout, exitCode } = await execa('npx', ['-y', 'wrangler', 'whoami'], {
      reject: false,
      env: { ...process.env, ...(token ? { CLOUDFLARE_API_TOKEN: token } : {}) },
    });

    if (exitCode === 0) {
      const match = stdout.match(/email '([^']+)'/);
      return {
        ok: true,
        account: match?.[1] || 'authenticated',
        plan: 'Free tier',
        freeSlots: '500 builds/month',
        quotaInfo: 'Free: unlimited bandwidth, 500 builds/month',
      };
    }
  } catch {}

  return {
    ok: false,
    account: null,
    quotaInfo: 'No Cloudflare token. Create one at https://dash.cloudflare.com/profile/api-tokens',
  };
}

export async function questions(ctx) {
  const { input } = await import('@inquirer/prompts');
  const projectName = await input({
    message: 'Cloudflare Pages project name (lowercase, hyphens only):',
    default: ctx.projectName,
    validate: (v) => /^[a-z0-9-]+$/.test(v) || 'Only lowercase letters, numbers, hyphens',
  });
  return { pagesProjectName: projectName };
}

export async function provision(ctx) {
  const {
    projectName,
    projectDir,
    answers = {},
    outputs: prevOutputs = {},
    dryRun = false,
    verbose = false,
  } = ctx;

  const pagesProjectName = answers['cloudflare-pages']?.pagesProjectName ?? projectName;

  if (dryRun) {
    return {
      outputs: {},
      resources: [],
      urls: {},
      dryRunPlan: [
        `wrangler pages project create ${pagesProjectName} --production-branch main`,
        `npm run build (in ${projectDir})`,
        `wrangler pages deploy dist --project-name ${pagesProjectName}`,
      ],
    };
  }

  const hasWrangler = await checkWrangler();
  if (!hasWrangler) {
    throw new Error('wrangler not installed. Run: npm install -g wrangler');
  }

  const env = { ...process.env };
  const storedToken = await getCredential('cloudflare', 'token');
  if (storedToken) env.CLOUDFLARE_API_TOKEN = storedToken;

  // Create Pages project (idempotent — fails gracefully if exists)
  const { exitCode: createExit, stderr: createErr } = await execa(
    'wrangler',
    ['pages', 'project', 'create', pagesProjectName, '--production-branch', 'main'],
    { cwd: projectDir, env, reject: false }
  );

  if (createExit !== 0 && !createErr?.includes('already exists')) {
    if (verbose) console.warn(`[cloudflare-pages] Create warning: ${createErr}`);
  }

  // Build the project
  await execa('npm', ['run', 'build'], { cwd: projectDir, env, stdio: verbose ? 'inherit' : 'pipe' });

  // Deploy
  const { stdout: deployOut, exitCode: deployExit } = await execa(
    'wrangler',
    ['pages', 'deploy', 'dist', '--project-name', pagesProjectName],
    { cwd: projectDir, env, reject: false }
  );

  if (deployExit !== 0) {
    throw new Error(`Cloudflare Pages deploy failed: ${deployOut}`);
  }

  const urlMatch = deployOut.match(/https:\/\/[a-z0-9-]+\.pages\.dev/);
  const deployUrl = urlMatch?.[0] ?? `https://${pagesProjectName}.pages.dev`;

  return {
    outputs: { CLOUDFLARE_PAGES_URL: deployUrl },
    resources: [{ type: 'cloudflare-pages-project', name: pagesProjectName }],
    urls: { deploy: deployUrl, dashboard: `https://dash.cloudflare.com/?to=/:account/pages/view/${pagesProjectName}` },
  };
}

export async function destroy(ctx, resources) {
  const chalk = (await import('chalk')).default;
  console.log(chalk.yellow('\n⚠  Cloudflare Pages deletion requires manual action:'));
  for (const r of resources) {
    if (r.type !== 'cloudflare-pages-project') continue;
    console.log(chalk.gray(`   → https://dash.cloudflare.com/?to=/:account/pages/view/${r.name}/settings`));
    console.log(chalk.gray('   → Go to Settings > Delete project'));
  }
}
