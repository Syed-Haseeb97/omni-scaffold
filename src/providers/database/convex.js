/**
 * src/providers/database/convex.js — Convex backend-as-a-service stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'convex',
    label: 'Convex (Reactive Backend)',
    category: 'database',
    freeTierNotes: 'Free: 1M function calls/month, 1GB storage',
    docsUrl: 'https://docs.convex.dev',
    setupUrl: 'https://dashboard.convex.dev',
    envVar: 'VITE_CONVEX_URL',
    tokenUrl: 'https://dashboard.convex.dev/settings/api-keys',
    manualSteps: [
      'Install Convex CLI: npm install -g convex',
      'Login: npx convex dev (opens browser)',
      'Get deployment URL from https://dashboard.convex.dev',
    ],
  }),
  meta: {
    id: 'convex',
    label: 'Convex (Reactive Backend)',
    category: 'database',
    freeTierNotes: 'Free: 1M function calls/month, 1GB storage',
    docsUrl: 'https://docs.convex.dev',
  },
};
