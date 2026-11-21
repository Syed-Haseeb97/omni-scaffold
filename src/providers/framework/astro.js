/**
 * src/providers/framework/astro.js — Astro scaffolding stub
 */
import { makeStub } from '../_stub.js';

const stub = makeStub({
  id: 'astro',
  label: 'Astro',
  category: 'framework',
  freeTierNotes: 'Free forever — local only',
  docsUrl: 'https://docs.astro.build',
  setupUrl: 'https://docs.astro.build/en/install/auto/',
  manualSteps: ['Run: npm create astro@latest'],
});

stub.meta = { id: 'astro', label: 'Astro', category: 'framework', freeTierNotes: 'Free forever — local only', docsUrl: 'https://docs.astro.build' };
stub.auth = { type: 'none', envVar: null, tokenInstructions: null, scopesNeeded: [] };
stub.verify = async () => ({ ok: true, account: 'local', quotaInfo: 'No limits' });

export const { meta, auth, verify, provision, destroy } = stub;
