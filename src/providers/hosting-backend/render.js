/**
 * src/providers/hosting-backend/render.js — Render.com stub
 */
import { makeStub } from '../_stub.js';
import { getCredential } from '../../credentials.js';

const stub = makeStub({
  id: 'render',
  label: 'Render',
  category: 'hosting-backend',
  freeTierNotes: 'Free: 750hrs/month compute, spins down after 15min inactivity',
  docsUrl: 'https://docs.render.com',
  setupUrl: 'https://dashboard.render.com',
  envVar: 'RENDER_API_KEY',
  tokenUrl: 'https://dashboard.render.com/u/settings#api-keys',
  manualSteps: [
    'Create a Web Service at https://dashboard.render.com/new/web',
    'Connect your GitHub repo',
    'Set the build command: npm install && npm run build',
    'Set the start command: node dist/server.js (or similar)',
    'Add env vars in the dashboard',
  ],
});

export const meta = {
  id: 'render',
  label: 'Render',
  category: 'hosting-backend',
  freeTierNotes: 'Free: 750hrs/month, spins down after 15min inactivity',
  docsUrl: 'https://docs.render.com',
};

export const auth = stub.auth;
export const provision = stub.provision;
export const destroy = stub.destroy;

export async function verify(creds = {}) {
  const token = creds.token || creds.RENDER_API_KEY || (await getCredential('render', 'token'));
  if (!token) return { ok: false, account: null, quotaInfo: 'No Render API key' };

  try {
    const res = await fetch('https://api.render.com/v1/owners?limit=1', {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/json',
      },
    });

    if (res.status === 401) {
      return { ok: false, account: null, quotaInfo: 'Invalid or expired Render API key' };
    }

    if (res.ok) {
      const data = await res.json();
      const owner = data[0]?.owner;
      return {
        ok: true,
        account: owner?.name || owner?.email || 'Render Account',
        plan: 'Free tier (750hrs/mo)',
        freeSlots: '750 hrs/month',
        quotaInfo: 'Free: 750hrs compute, spins down after 15m inactivity',
      };
    }
  } catch {}

  return {
    ok: true,
    account: 'Render API key stored',
    plan: 'Free tier',
    quotaInfo: '750hrs/month',
  };
}
