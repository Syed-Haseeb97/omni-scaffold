/**
 * src/providers/framework/sveltekit.js — SvelteKit scaffolding stub
 */
import { makeStub } from '../_stub.js';

const stub = makeStub({
  id: 'sveltekit',
  label: 'SvelteKit',
  category: 'framework',
  freeTierNotes: 'Free forever — local only',
  docsUrl: 'https://kit.svelte.dev/docs',
  setupUrl: 'https://kit.svelte.dev/docs/creating-a-project',
  manualSteps: ['Run: npm create svelte@latest <project-name>'],
});

stub.meta = { id: 'sveltekit', label: 'SvelteKit', category: 'framework', freeTierNotes: 'Free forever — local only', docsUrl: 'https://kit.svelte.dev/docs' };
stub.auth = { type: 'none', envVar: null, tokenInstructions: null, scopesNeeded: [] };
stub.verify = async () => ({ ok: true, account: 'local', quotaInfo: 'No limits' });

export const { meta, auth, verify, provision, destroy } = stub;
