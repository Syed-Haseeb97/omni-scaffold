/**
 * src/providers/extras/upstash.js — Upstash Redis (real API)
 */
import { getCredential } from '../../credentials.js';

export const meta = {
  id: 'upstash',
  label: 'Upstash (Redis)',
  category: 'extras',
  freeTierNotes: 'Free: 10K commands/day, 256MB storage',
  docsUrl: 'https://docs.upstash.com',
};

export const auth = {
  type: 'token',
  envVar: 'UPSTASH_REDIS_REST_TOKEN',
  tokenInstructions: 'Create an API key at https://console.upstash.com/account/api',
  scopesNeeded: [],
};

export async function verify() {
  const token = await getCredential('upstash', 'token');
  const email = await getCredential('upstash', 'email');
  if (!token || !email) return { ok: false, account: null, quotaInfo: 'No credentials stored. Run `omni setup --provider upstash`.' };
  try {
    const res = await fetch('https://api.upstash.com/v2/redis/databases', {
      headers: { Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}` },
    });
    if (res.ok) return { ok: true, account: email, quotaInfo: 'Credentials valid' };
    return { ok: false, account: null, quotaInfo: `API error: ${res.status}` };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

export async function provision(ctx) {
  const { projectName, dryRun } = ctx;
  const token = await getCredential('upstash', 'token');
  const email = await getCredential('upstash', 'email');

  if (dryRun || !token) {
    return {
      outputs: {
        UPSTASH_REDIS_REST_URL: 'https://your-db.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: token || 'your-token',
      },
      resources: [],
      urls: { dashboard: 'https://console.upstash.com' },
      dryRunPlan: ['Create Upstash Redis database', 'Inject UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'],
    };
  }

  const createRes = await fetch('https://api.upstash.com/v2/redis/database', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name: projectName, region: 'us-east-1', tls: true }),
  });

  if (!createRes.ok) {
    // If 409 (already exists), just inject the stored token
    const outputs = { UPSTASH_REDIS_REST_TOKEN: token };
    return { outputs, resources: [], urls: { dashboard: 'https://console.upstash.com' } };
  }

  const db = await createRes.json();
  return {
    outputs: {
      UPSTASH_REDIS_REST_URL: `https://${db.endpoint}`,
      UPSTASH_REDIS_REST_TOKEN: db.rest_token || token,
    },
    resources: [{ type: 'upstash-redis', id: db.database_id, name: projectName }],
    urls: { dashboard: `https://console.upstash.com/redis/${db.database_id}` },
  };
}

export async function destroy(ctx) {
  const { resources } = ctx;
  const token = await getCredential('upstash', 'token');
  const email = await getCredential('upstash', 'email');
  const redisResources = resources?.upstash || [];

  for (const r of redisResources) {
    if (r.id) {
      await fetch(`https://api.upstash.com/v2/redis/database/${r.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Basic ${Buffer.from(`${email}:${token}`).toString('base64')}` },
      });
    }
  }
  return { ok: true };
}
