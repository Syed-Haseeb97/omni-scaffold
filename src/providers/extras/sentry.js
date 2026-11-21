/**
 * src/providers/extras/sentry.js — Sentry error tracking (real API)
 */
import { getCredential } from '../../credentials.js';

export const meta = {
  id: 'sentry',
  label: 'Sentry (Error Tracking)',
  category: 'extras',
  freeTierNotes: 'Free: 5K errors/month, 1 team member',
  docsUrl: 'https://docs.sentry.io',
};

export const auth = {
  type: 'token',
  envVar: 'SENTRY_AUTH_TOKEN',
  tokenInstructions: 'Create an auth token at https://sentry.io/settings/account/api/auth-tokens/',
  scopesNeeded: ['project:write', 'project:read'],
};

export async function verify() {
  const token = await getCredential('sentry', 'token');
  if (!token) return { ok: false, account: null, quotaInfo: 'No token stored. Run `omni setup --provider sentry`.' };
  try {
    const res = await fetch('https://sentry.io/api/0/organizations/', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const orgs = await res.json();
      return { ok: true, account: orgs[0]?.slug || 'sentry', quotaInfo: `${orgs.length} org(s)` };
    }
    return { ok: false, account: null, quotaInfo: `API error: ${res.status}` };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

export async function provision(ctx) {
  const { projectName, dryRun } = ctx;
  const token = await getCredential('sentry', 'token');

  if (dryRun || !token) {
    return {
      outputs: {
        SENTRY_DSN: 'https://key@sentry.io/project',
        SENTRY_AUTH_TOKEN: token || 'your-token',
      },
      resources: [],
      urls: { dashboard: 'https://sentry.io' },
      dryRunPlan: ['Create Sentry project', 'Retrieve DSN', 'Inject SENTRY_DSN + SENTRY_AUTH_TOKEN'],
    };
  }

  // Get org slug
  const orgsRes = await fetch('https://sentry.io/api/0/organizations/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!orgsRes.ok) throw new Error(`Sentry API error: ${orgsRes.status}`);
  const orgs = await orgsRes.json();
  const orgSlug = orgs[0]?.slug;
  if (!orgSlug) throw new Error('Sentry: No organization found');

  // Create project (use org's default team)
  const teamsRes = await fetch(`https://sentry.io/api/0/organizations/${orgSlug}/teams/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const teams = teamsRes.ok ? await teamsRes.json() : [];
  const teamSlug = teams[0]?.slug || orgSlug;

  const createRes = await fetch(`https://sentry.io/api/0/teams/${orgSlug}/${teamSlug}/projects/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: projectName, platform: 'javascript-react' }),
  });

  let projectSlug = projectName;
  if (createRes.ok) {
    const created = await createRes.json();
    projectSlug = created.slug;
  }

  // Get DSN
  const keysRes = await fetch(`https://sentry.io/api/0/projects/${orgSlug}/${projectSlug}/keys/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const keys = keysRes.ok ? await keysRes.json() : [];
  const dsn = keys[0]?.dsn?.public || '';

  return {
    outputs: { SENTRY_DSN: dsn, SENTRY_AUTH_TOKEN: token, SENTRY_ORG: orgSlug, SENTRY_PROJECT: projectSlug },
    resources: [{ type: 'sentry-project', id: projectSlug, name: projectName }],
    urls: { dashboard: `https://sentry.io/organizations/${orgSlug}/projects/${projectSlug}/` },
  };
}

export async function destroy(ctx) {
  const { resources } = ctx;
  const token = await getCredential('sentry', 'token');
  const sentryResources = resources?.sentry || [];

  if (!token || sentryResources.length === 0) return { ok: true };

  // Get org to delete project
  const orgsRes = await fetch('https://sentry.io/api/0/organizations/', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!orgsRes.ok) return { ok: false };
  const orgs = await orgsRes.json();
  const orgSlug = orgs[0]?.slug;

  for (const r of sentryResources) {
    if (r.id && orgSlug) {
      await fetch(`https://sentry.io/api/0/projects/${orgSlug}/${r.id}/`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  }
  return { ok: true };
}
