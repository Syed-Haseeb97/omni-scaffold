/**
 * src/providers/database/supabase.js — Supabase database + auth provider
 *
 * API Docs: https://supabase.com/docs/reference/api/introduction
 * Date checked: 2026-11-09
 *
 * Auth strategy:
 *   1. `supabase login` via CLI (opens browser OAuth)
 *   2. Personal Access Token from https://app.supabase.com/account/tokens
 *
 * Provision flow:
 *   1. GET /v1/organizations — find org ID
 *   2. POST /v1/projects — create project
 *   3. Poll GET /v1/projects/{ref} until status === "ACTIVE_HEALTHY" (up to 5 min)
 *   4. GET /v1/projects/{ref}/api-keys?reveal=true — get anon + service_role keys
 *
 * Also includes Supabase Auth (bundled — no extra API calls needed).
 */

import { execa } from 'execa';
import { getCredential, storeCredential, mask } from '../../credentials.js';

const BASE_URL = 'https://api.supabase.com';

const HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'User-Agent': 'omni-scaffold/0.1.0',
});

export const meta = {
  id: 'supabase',
  label: 'Supabase (DB + Auth)',
  category: 'database',
  freeTierNotes: 'Free: 2 projects, 500MB DB, 50K auth users',
  docsUrl: 'https://supabase.com/docs',
};

export const auth = {
  type: 'token',
  envVar: 'SUPABASE_ACCESS_TOKEN',
  tokenUrl: 'https://app.supabase.com/account/tokens',
  tokenInstructions: 'Generate a Personal Access Token at https://app.supabase.com/account/tokens',
  scopesNeeded: ['project:read', 'project:write'],
};

async function getToken() {
  const stored = await getCredential('supabase', 'token');
  if (stored) return stored;
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN;
  return null;
}

export async function verify(creds = {}) {
  const token = creds.token || (await getToken());
  if (!token) {
    return { ok: false, account: null, quotaInfo: 'No Supabase token. Generate one at https://app.supabase.com/account/tokens' };
  }

  try {
    const res = await fetch(`${BASE_URL}/v1/projects`, { headers: HEADERS(token) });

    if (res.status === 401) {
      return { ok: false, account: null, quotaInfo: 'Token invalid or expired' };
    }

    const projects = await res.json();
    const count = Array.isArray(projects) ? projects.length : 0;
    const freeSlots = Math.max(0, 2 - count);

    // Also detect organization
    let orgName = 'personal';
    try {
      const orgRes = await fetch(`${BASE_URL}/v1/organizations`, { headers: HEADERS(token) });
      if (orgRes.ok) {
        const orgs = await orgRes.json();
        if (orgs.length > 0) {
          orgName = orgs[0].name || orgs[0].id;
          const { saveConfig } = await import('../../config.js');
          saveConfig({ supabaseOrgId: orgs[0].id });
        }
      }
    } catch {}

    return {
      ok: res.ok,
      account: `${orgName} (${count} active project${count === 1 ? '' : 's'})`,
      plan: 'Free (2 projects max)',
      freeSlots,
      quotaInfo: `Free tier: ${count}/2 projects used. ${freeSlots} free slot(s) remaining.${count >= 2 ? ' ⚠ No free slots — upgrade or delete a project.' : ''}`,
    };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

export async function questions(ctx) {
  const { select, password: passwordPrompt } = await import('@inquirer/prompts');

  const regions = [
    { name: 'US East (N. Virginia)', value: 'us-east-1' },
    { name: 'US West (Oregon)', value: 'us-west-1' },
    { name: 'EU West (Ireland)', value: 'eu-west-1' },
    { name: 'Asia Pacific (Singapore)', value: 'ap-southeast-1' },
    { name: 'Asia Pacific (Tokyo)', value: 'ap-northeast-1' },
    { name: 'South Asia (Mumbai)', value: 'ap-south-1' },
  ];

  const region = await select({
    message: 'Supabase region:',
    choices: regions,
    default: 'us-east-1',
  });

  const dbPassword = await passwordPrompt({
    message: 'Database password (min 16 chars, omni will store it):',
    validate: (v) => v.length >= 16 || 'Password must be at least 16 characters',
  });

  return { region, dbPassword };
}

export async function provision(ctx) {
  const {
    projectName,
    answers = {},
    dryRun = false,
    verbose = false,
    outputs: prevOutputs = {},
  } = ctx;

  const region = answers['supabase']?.region ?? 'us-east-1';
  const dbPassword = answers['supabase']?.dbPassword;

  if (dryRun) {
    return {
      outputs: {},
      resources: [],
      urls: {},
      dryRunPlan: [
        `GET ${BASE_URL}/v1/organizations — find organization_id`,
        `POST ${BASE_URL}/v1/projects { name: "${projectName}", region: "${region}", db_pass: "***", organization_id: "<org_id>" }`,
        `Poll GET ${BASE_URL}/v1/projects/{ref} until status === "ACTIVE_HEALTHY"`,
        `GET ${BASE_URL}/v1/projects/{ref}/api-keys?reveal=true — extract anon + service_role keys`,
      ],
    };
  }

  if (!dbPassword) {
    throw new Error('Supabase: dbPassword is required');
  }

  const token = await getToken();
  if (!token) {
    throw new Error('Supabase: No token. Run `supabase login` or `omni setup --provider supabase`');
  }

  // Step 1: Get organization ID
  const orgsRes = await fetch(`${BASE_URL}/v1/organizations`, { headers: HEADERS(token) });
  if (!orgsRes.ok) {
    const err = await orgsRes.text();
    throw new Error(`Supabase: Failed to list organizations (${orgsRes.status}): ${err}`);
  }
  const orgs = await orgsRes.json();
  if (!orgs.length) {
    throw new Error('Supabase: No organizations found. Create one at https://app.supabase.com');
  }
  const orgId = orgs[0].id;
  if (verbose) console.log(`[supabase] Using org: ${orgs[0].name} (${orgId})`);

  // Step 2: Check if project already exists (idempotent)
  const projectsRes = await fetch(`${BASE_URL}/v1/projects`, { headers: HEADERS(token) });
  const existingProjects = await projectsRes.json();
  let projectRef = existingProjects.find((p) => p.name === projectName)?.ref;

  if (projectRef) {
    if (verbose) console.log(`[supabase] Project "${projectName}" already exists (ref: ${projectRef})`);
  } else {
    // Step 3: Create project
    const createRes = await fetch(`${BASE_URL}/v1/projects`, {
      method: 'POST',
      headers: HEADERS(token),
      body: JSON.stringify({
        name: projectName,
        organization_id: orgId,
        db_pass: dbPassword,
        region,
        plan: 'free',
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      if (err.message?.includes('free project limit')) {
        throw new Error(
          'Supabase: Free tier limit reached (2 projects max).\n' +
            '  → Delete a project at https://app.supabase.com or upgrade to Pro.\n' +
            '  → Run `omni doctor` to see your current project count.'
        );
      }
      throw new Error(`Supabase project creation failed: ${createRes.status} — ${JSON.stringify(err)}`);
    }

    const created = await createRes.json();
    projectRef = created.ref;
    if (verbose) console.log(`[supabase] Created project (ref: ${projectRef}), waiting for ACTIVE_HEALTHY...`);
  }

  // Step 4: Poll until ACTIVE_HEALTHY
  const projectUrl = await _waitForHealthy(token, projectRef, verbose);

  // Step 5: Get API keys
  const keysRes = await fetch(`${BASE_URL}/v1/projects/${projectRef}/api-keys?reveal=true`, {
    headers: HEADERS(token),
  });
  if (!keysRes.ok) {
    throw new Error(`Supabase: Failed to fetch API keys (${keysRes.status})`);
  }

  const keys = await keysRes.json();
  const anonKey = keys.find((k) => k.name === 'anon')?.api_key;
  const serviceRoleKey = keys.find((k) => k.name === 'service_role')?.api_key;

  if (!anonKey || !serviceRoleKey) {
    throw new Error('Supabase: Could not extract anon/service_role keys from API response');
  }

  const supabaseUrl = `https://${projectRef}.supabase.co`;

  return {
    outputs: {
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: anonKey,
      SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      SUPABASE_PROJECT_REF: projectRef,
      SUPABASE_DB_URL: `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
    },
    resources: [
      {
        type: 'supabase-project',
        ref: projectRef,
        name: projectName,
        url: supabaseUrl,
      },
    ],
    urls: {
      dashboard: `https://app.supabase.com/project/${projectRef}`,
      api: supabaseUrl,
    },
  };
}

export async function destroy(ctx, resources) {
  const token = await getToken();
  if (!token) throw new Error('Supabase: No token for cleanup');

  for (const resource of resources) {
    if (resource.type !== 'supabase-project') continue;

    const { ref } = resource;
    const res = await fetch(`${BASE_URL}/v1/projects/${ref}`, {
      method: 'DELETE',
      headers: HEADERS(token),
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Supabase project deletion failed: ${res.status}`);
    }

    if (ctx.verbose) console.log(`[supabase] Deleted project ${ref}`);
  }
}

/**
 * Poll GET /v1/projects/{ref} until status === "ACTIVE_HEALTHY".
 * Timeout: 5 minutes.
 */
async function _waitForHealthy(token, ref, verbose, timeoutMs = 5 * 60 * 1000) {
  const start = Date.now();
  const pollInterval = 10_000; // 10s

  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${BASE_URL}/v1/projects/${ref}`, { headers: HEADERS(token) });
    if (!res.ok) throw new Error(`Supabase: Status poll failed (${res.status})`);

    const project = await res.json();
    if (verbose) console.log(`[supabase] Status: ${project.status}`);

    if (project.status === 'ACTIVE_HEALTHY') {
      return `https://${ref}.supabase.co`;
    }

    if (project.status === 'INACTIVE' || project.status === 'GOING_DOWN') {
      throw new Error(`Supabase project entered unexpected status: ${project.status}`);
    }

    // Handle rate limit
    await _sleep(pollInterval);
  }

  throw new Error('Supabase: Project did not become ACTIVE_HEALTHY within 5 minutes');
}

function _sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
