/**
 * src/providers/hosting-frontend/vercel.js — Vercel frontend hosting provider
 *
 * API Docs: https://vercel.com/docs/rest-api
 * Date checked: 2026-11-09
 *
 * Auth strategy:
 *   1. `vercel login` via CLI (OAuth)
 *   2. API token from https://vercel.com/account/tokens
 *
 * Provision flow:
 *   1. GET /v2/user — get username + plan
 *   2. POST /v10/projects — create project, optionally link GitHub repo
 *   3. POST /v10/projects/{id}/env — inject env vars (production + preview + development)
 *   4. POST /v13/deployments — trigger first deploy from GitHub
 *   5. Poll GET /v13/deployments/{id} until readyState === "READY"
 */

import { execa } from 'execa';
import { getCredential } from '../../credentials.js';

const BASE_URL = 'https://api.vercel.com';

const HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'omni-scaffold/0.1.0',
});

export const meta = {
  id: 'vercel',
  label: 'Vercel',
  category: 'hosting-frontend',
  freeTierNotes: 'Free: Hobby plan, unlimited deploys, 100GB bandwidth/month',
  docsUrl: 'https://vercel.com/docs',
};

export const auth = {
  type: 'token',
  envVar: 'VERCEL_TOKEN',
  tokenUrl: 'https://vercel.com/account/tokens',
  tokenInstructions: 'Create an Access Token at https://vercel.com/account/tokens (Full Account scope, No Expiration)',
  scopesNeeded: ['full-account'],
};

async function getToken() {
  const stored = await getCredential('vercel', 'token');
  if (stored) return stored;
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  return null;
}

export async function verify(creds = {}) {
  const token = creds.token || (await getToken());
  if (!token) {
    return { ok: false, account: null, quotaInfo: 'No Vercel token. Create one at https://vercel.com/account/tokens' };
  }

  try {
    const res = await fetch(`${BASE_URL}/v2/user`, { headers: HEADERS(token) });

    if (res.status === 401) {
      return { ok: false, account: null, quotaInfo: 'Token invalid or expired' };
    }

    const data = await res.json();
    const user = data.user;
    const plan = user?.billing?.plan ?? 'Hobby (free)';

    // Save user info to config
    try {
      const { saveConfig } = await import('../../config.js');
      saveConfig({ vercelUsername: user?.username });
    } catch {}

    return {
      ok: res.ok,
      account: user?.username || user?.email,
      plan,
      freeSlots: 'Unlimited hobby deployments',
      quotaInfo: `Plan: ${plan} (100GB bandwidth/month, unlimited deploys)`,
    };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

export async function questions(ctx) {
  const { select } = await import('@inquirer/prompts');

  const framework = await select({
    message: 'Vercel framework preset:',
    choices: [
      { name: 'Vite (React)', value: 'vite' },
      { name: 'Next.js', value: 'nextjs' },
      { name: 'Astro', value: 'astro' },
      { name: 'SvelteKit', value: 'svelte-kit' },
      { name: 'Other / None', value: null },
    ],
    default: 'vite',
  });

  return { framework };
}

export async function provision(ctx) {
  const {
    projectName,
    answers = {},
    outputs: prevOutputs = {},
    dryRun = false,
    verbose = false,
  } = ctx;

  const framework = answers['vercel']?.framework ?? 'vite';
  const githubRepo = prevOutputs['github-create']?.GITHUB_REPO; // "owner/repo"
  const envVars = _collectEnvVars(prevOutputs);

  if (dryRun) {
    return {
      outputs: {},
      resources: [],
      urls: {},
      dryRunPlan: [
        `POST ${BASE_URL}/v10/projects { name: "${projectName}", framework: "${framework}"${githubRepo ? `, gitRepository: { type: "github", repo: "${githubRepo}" }` : ''} }`,
        ...Object.entries(envVars).map(
          ([k]) => `POST ${BASE_URL}/v10/projects/{id}/env { key: "${k}", type: "encrypted", target: ["production","preview","development"] }`
        ),
        `POST ${BASE_URL}/v13/deployments { name: "${projectName}", gitSource: { type: "github", repo: "${githubRepo}", ref: "main" } }`,
        `Poll GET ${BASE_URL}/v13/deployments/{id} until readyState === "READY"`,
      ],
    };
  }

  const token = await getToken();
  if (!token) {
    throw new Error('Vercel: No token. Run `omni setup --provider vercel`');
  }

  // Check if project already exists
  const checkRes = await fetch(`${BASE_URL}/v9/projects/${projectName}`, {
    headers: HEADERS(token),
  });

  let projectId;

  if (checkRes.status === 200) {
    const existing = await checkRes.json();
    projectId = existing.id;
    if (verbose) console.log(`[vercel] Project "${projectName}" already exists (${projectId})`);
  } else {
    // Create project
    const body = { name: projectName };
    if (framework) body.framework = framework;
    if (githubRepo) {
      body.gitRepository = { type: 'github', repo: githubRepo };
    }

    const createRes = await fetch(`${BASE_URL}/v10/projects`, {
      method: 'POST',
      headers: HEADERS(token),
      body: JSON.stringify(body),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`Vercel project creation failed: ${createRes.status} — ${JSON.stringify(err)}`);
    }

    const created = await createRes.json();
    projectId = created.id;
    if (verbose) console.log(`[vercel] Created project: ${projectId}`);
  }

  // Inject env vars
  if (Object.keys(envVars).length > 0) {
    const envPayload = Object.entries(envVars).map(([key, value]) => ({
      key,
      value,
      type: 'encrypted',
      target: ['production', 'preview', 'development'],
    }));

    const envRes = await fetch(`${BASE_URL}/v10/projects/${projectId}/env?upsert=true`, {
      method: 'POST',
      headers: HEADERS(token),
      body: JSON.stringify(envPayload),
    });

    if (!envRes.ok && verbose) {
      const err = await envRes.text();
      console.warn(`[vercel] Warning: env var injection returned ${envRes.status}: ${err}`);
    } else if (verbose) {
      console.log(`[vercel] Injected ${envPayload.length} env var(s)`);
    }
  }

  // Trigger deployment
  if (!githubRepo) {
    // No GitHub repo — can't trigger git-based deploy
    return {
      outputs: { VERCEL_PROJECT_ID: projectId, VERCEL_URL: `https://${projectName}.vercel.app` },
      resources: [{ type: 'vercel-project', id: projectId, name: projectName }],
      urls: { project: `https://vercel.com/${projectName}`, deploy: `https://${projectName}.vercel.app` },
    };
  }

  const deployRes = await fetch(`${BASE_URL}/v13/deployments`, {
    method: 'POST',
    headers: HEADERS(token),
    body: JSON.stringify({
      name: projectName,
      target: 'production',
      gitSource: {
        type: 'github',
        repo: githubRepo,
        ref: 'main',
      },
    }),
  });

  if (!deployRes.ok) {
    const err = await deployRes.json().catch(() => ({}));
    throw new Error(`Vercel deploy trigger failed: ${deployRes.status} — ${JSON.stringify(err)}`);
  }

  const deployment = await deployRes.json();
  const deployId = deployment.id;
  if (verbose) console.log(`[vercel] Deployment started: ${deployId}`);

  // Poll for READY
  const liveUrl = await _waitForDeployment(token, deployId, verbose);

  return {
    outputs: {
      VERCEL_PROJECT_ID: projectId,
      VERCEL_URL: liveUrl,
      VERCEL_DEPLOYMENT_ID: deployId,
    },
    resources: [{ type: 'vercel-project', id: projectId, name: projectName }],
    urls: {
      project: `https://vercel.com/${projectName}`,
      deploy: liveUrl,
    },
  };
}

export async function destroy(ctx, resources) {
  const token = await getToken();
  if (!token) throw new Error('Vercel: No token for cleanup');

  for (const resource of resources) {
    if (resource.type !== 'vercel-project') continue;

    const res = await fetch(`${BASE_URL}/v9/projects/${resource.id}`, {
      method: 'DELETE',
      headers: HEADERS(token),
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Vercel project deletion failed: ${res.status}`);
    }

    if (ctx.verbose) console.log(`[vercel] Deleted project ${resource.id}`);
  }
}

/**
 * Poll GET /v13/deployments/{id} until readyState === "READY".
 * @param {string} token
 * @param {string} deployId
 * @param {boolean} verbose
 * @param {number} timeoutMs
 */
async function _waitForDeployment(token, deployId, verbose, timeoutMs = 10 * 60 * 1000) {
  const start = Date.now();
  const pollInterval = 15_000; // 15s

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/v13/deployments/${deployId}`, {
      headers: HEADERS(token),
    });

    if (!res.ok) {
      // Handle rate limit
      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') || '30', 10);
        if (verbose) console.log(`[vercel] Rate limited, waiting ${retryAfter}s...`);
        await _sleep(retryAfter * 1000);
        continue;
      }
      throw new Error(`Vercel: Deployment status poll failed (${res.status})`);
    }

    const data = await res.json();
    if (verbose) console.log(`[vercel] Deployment status: ${data.readyState}`);

    if (data.readyState === 'READY') {
      return `https://${data.url}`;
    }
    if (data.readyState === 'ERROR' || data.readyState === 'CANCELED') {
      throw new Error(`Vercel deployment failed with state: ${data.readyState}`);
    }

    await _sleep(pollInterval);
  }

  throw new Error('Vercel: Deployment did not become READY within 10 minutes');
}

/**
 * Collect env vars from previous step outputs that should go to Vercel.
 * @param {object} prevOutputs - Outputs from previous DAG steps
 * @returns {Record<string, string>}
 */
function _collectEnvVars(prevOutputs) {
  const envVars = {};
  for (const stepOutput of Object.values(prevOutputs)) {
    if (typeof stepOutput !== 'object') continue;
    for (const [key, value] of Object.entries(stepOutput)) {
      // Include vars that look like env vars (uppercase with underscores)
      // Exclude internal omni tracking vars
      if (
        /^[A-Z][A-Z0-9_]+$/.test(key) &&
        !['GITHUB_REPO', 'GITHUB_DEFAULT_BRANCH', 'FRAMEWORK'].includes(key) &&
        typeof value === 'string'
      ) {
        envVars[key] = value;
      }
    }
  }
  return envVars;
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
