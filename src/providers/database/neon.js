/**
 * src/providers/database/neon.js — Neon serverless Postgres provider
 *
 * API Docs: https://api-docs.neon.tech/reference/getting-started-with-neon-api
 * Date checked: 2026-11-09
 *
 * Auth: Neon API Key from https://console.neon.tech/app/settings/api-keys
 *
 * Provision flow:
 *   1. POST /projects — creates project; connection_uri returned immediately in response
 *   2. No polling needed — Neon provisions synchronously
 *
 * Note: Project delete is soft (recoverable for ~7 days via POST /projects/{id}/recover)
 */

import { getCredential } from '../../credentials.js';

const BASE_URL = 'https://console.neon.tech/api/v2';

const HEADERS = (token) => ({
  Authorization: `Bearer ${token.trim()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'User-Agent': 'omni-scaffold/0.1.0',
});

export const meta = {
  id: 'neon',
  label: 'Neon (Serverless Postgres)',
  category: 'database',
  freeTierNotes: 'Free: 1 project, 500MB storage, auto-suspend',
  docsUrl: 'https://neon.tech/docs',
};

export const auth = {
  type: 'token',
  envVar: 'NEON_API_KEY',
  tokenUrl: 'https://console.neon.tech/app/settings/api-keys',
  tokenInstructions: 'Create an API key at https://console.neon.tech/app/settings/api-keys',
  scopesNeeded: [],
};

async function getToken() {
  const stored = await getCredential('neon', 'token');
  if (stored) return stored;
  if (process.env.NEON_API_KEY) return process.env.NEON_API_KEY;
  return null;
}

export async function verify(creds = {}) {
  const token = creds.token || (await getToken());
  if (!token) {
    return { ok: false, account: null, quotaInfo: 'No Neon API key. See: https://console.neon.tech/app/settings/api-keys' };
  }

  try {
    let orgId = null;
    let orgName = '';

    // Auto-detect organization if key is org-scoped via /users/me/organizations
    try {
      const orgRes = await fetch(`${BASE_URL}/users/me/organizations`, { headers: HEADERS(token) });
      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const orgs = orgData.organizations || orgData;
        if (Array.isArray(orgs) && orgs.length > 0) {
          orgId = orgs[0].id;
          orgName = orgs[0].name || orgId;
          const { saveConfig } = await import('../../config.js');
          saveConfig({ neonOrgId: orgId });
        }
      }
    } catch {}

    // Fallback: check active organization in /users/me
    try {
      if (!orgId) {
        const meRes = await fetch(`${BASE_URL}/users/me`, { headers: HEADERS(token) });
        if (meRes.ok) {
          const meData = await meRes.json();
          if (meData.active_organization_id) {
            orgId = meData.active_organization_id;
            const { saveConfig } = await import('../../config.js');
            saveConfig({ neonOrgId: orgId });
          }
        }
      }
    } catch {}

    // Fallback: check saved config or environment
    if (!orgId) {
      try {
        const { loadConfig } = await import('../../config.js');
        const cfg = loadConfig();
        if (cfg.neonOrgId) orgId = cfg.neonOrgId;
        else if (process.env.NEON_ORG_ID) orgId = process.env.NEON_ORG_ID;
      } catch {}
    }

    const url = orgId ? `${BASE_URL}/projects?org_id=${orgId}&limit=10` : `${BASE_URL}/projects?limit=10`;
    const res = await fetch(url, { headers: HEADERS(token) });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        ok: false,
        account: null,
        quotaInfo: `Neon API error (${res.status}): ${err.message || res.statusText}`,
      };
    }

    const data = await res.json();
    const count = data.projects?.length ?? 0;

    return {
      ok: true,
      account: orgName ? `${orgName} (${count} project(s))` : `${count} project(s)`,
      plan: 'Free tier (1 project, 500MB)',
      freeSlots: Math.max(0, 1 - count),
      quotaInfo: `Free tier: ${count}/1 project used.`,
    };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

export async function questions(ctx) {
  const { select } = await import('@inquirer/prompts');

  const region = await select({
    message: 'Neon region:',
    choices: [
      { name: 'AWS US East 1 (N. Virginia)', value: 'aws-us-east-1' },
      { name: 'AWS US East 2 (Ohio)', value: 'aws-us-east-2' },
      { name: 'AWS EU West 2 (London)', value: 'aws-eu-west-2' },
      { name: 'AWS AP Southeast 1 (Singapore)', value: 'aws-ap-southeast-1' },
    ],
    default: 'aws-us-east-1',
  });

  return { region };
}

export async function provision(ctx) {
  const {
    projectName,
    answers = {},
    dryRun = false,
    verbose = false,
  } = ctx;

  const region = answers['neon']?.region ?? 'aws-us-east-1';

  if (dryRun) {
    return {
      outputs: {},
      resources: [],
      urls: {},
      dryRunPlan: [
        `POST ${BASE_URL}/projects { project: { name: "${projectName}", region_id: "${region}" } }`,
        '← response includes connection_uris[0].connection_uri immediately (no polling needed)',
      ],
    };
  }

  const token = await getToken();
  if (!token) {
    throw new Error('Neon: No API key. Run `omni setup --provider neon`');
  }

  const { loadConfig } = await import('../../config.js');
  const config = loadConfig();
  const orgId = config.neonOrgId;

  // Check if project already exists (idempotent by name search)
  const listUrl = orgId ? `${BASE_URL}/projects?org_id=${orgId}&limit=100` : `${BASE_URL}/projects?limit=100`;
  const listRes = await fetch(listUrl, { headers: HEADERS(token) });
  if (!listRes.ok) throw new Error(`Neon: Failed to list projects (${listRes.status})`);
  const listData = await listRes.json();
  const existing = listData.projects?.find((p) => p.name === projectName);

  let project, connectionUri;

  if (existing) {
    if (verbose) console.log(`[neon] Project "${projectName}" already exists (${existing.id})`);
    project = existing;

    // Fetch connection string for existing project
    const connRes = await fetch(
      `${BASE_URL}/projects/${project.id}/connection_uri?database_name=neondb&role_name=neondb_owner`,
      { headers: HEADERS(token) }
    );
    if (!connRes.ok) throw new Error(`Neon: Failed to get connection URI (${connRes.status})`);
    const connData = await connRes.json();
    connectionUri = connData.connection_uri;
  } else {
    // Create new project
    const createRes = await fetch(`${BASE_URL}/projects`, {
      method: 'POST',
      headers: HEADERS(token),
      body: JSON.stringify({
        project: {
          name: projectName,
          region_id: region,
          pg_version: 17,
          ...(orgId ? { org_id: orgId } : {}),
        },
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`Neon project creation failed: ${createRes.status} — ${JSON.stringify(err)}`);
    }

    const created = await createRes.json();
    project = created.project;
    connectionUri = created.connection_uris?.[0]?.connection_uri;

    if (verbose) console.log(`[neon] Created project: ${project.id}`);
  }

  if (!connectionUri) {
    throw new Error('Neon: No connection URI in response');
  }

  return {
    outputs: {
      DATABASE_URL: connectionUri,
      NEON_PROJECT_ID: project.id,
    },
    resources: [
      {
        type: 'neon-project',
        id: project.id,
        name: project.name,
      },
    ],
    urls: {
      dashboard: `https://console.neon.tech/app/projects/${project.id}`,
    },
  };
}

export async function destroy(ctx, resources) {
  const token = await getToken();
  if (!token) throw new Error('Neon: No API key for cleanup');

  for (const resource of resources) {
    if (resource.type !== 'neon-project') continue;

    const res = await fetch(`${BASE_URL}/projects/${resource.id}`, {
      method: 'DELETE',
      headers: HEADERS(token),
    });

    if (!res.ok && res.status !== 404) {
      throw new Error(`Neon project deletion failed: ${res.status}`);
    }

    if (ctx.verbose) {
      console.log(`[neon] Deleted project ${resource.id} (soft-delete; recoverable for ~7 days)`);
    }
  }
}
