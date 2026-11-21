/**
 * src/providers/extras/resend.js — Resend email provider (real API)
 */
import { getCredential } from '../../credentials.js';

export const meta = {
  id: 'resend',
  label: 'Resend (Email)',
  category: 'extras',
  freeTierNotes: 'Free: 3,000 emails/month, 100/day',
  docsUrl: 'https://resend.com/docs',
};

export const auth = {
  type: 'token',
  envVar: 'RESEND_API_KEY',
  tokenInstructions: 'Create an API key at https://resend.com/api-keys',
  scopesNeeded: ['send:email'],
};

export async function verify() {
  const token = await getCredential('resend', 'token');
  if (!token) return { ok: false, account: null, quotaInfo: 'No token stored. Run `omni setup --provider resend`.' };
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { ok: true, account: 'resend', quotaInfo: 'API key valid' };
    return { ok: false, account: null, quotaInfo: `API error: ${res.status}` };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

export async function provision(ctx) {
  const { projectName, dryRun } = ctx;
  const token = await getCredential('resend', 'token');

  if (dryRun || !token) {
    return {
      outputs: { RESEND_API_KEY: token || 'your-resend-api-key' },
      resources: [],
      urls: { dashboard: 'https://resend.com/api-keys' },
      dryRunPlan: ['Inject RESEND_API_KEY into project .env.local'],
    };
  }

  // Verify domain list (lightweight health check, no real provisioning needed)
  await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  return {
    outputs: { RESEND_API_KEY: token },
    resources: [],
    urls: { dashboard: 'https://resend.com/api-keys' },
  };
}

export async function destroy(ctx) {
  // No remote resources to destroy — just drop the env var
  return { ok: true };
}
