/**
 * src/providers/hosting-backend/flyio.js — Fly.io stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'flyio',
    label: 'Fly.io',
    category: 'hosting-backend',
    freeTierNotes: 'Free: 3 shared VMs, 160GB bandwidth/month',
    docsUrl: 'https://fly.io/docs',
    setupUrl: 'https://fly.io',
    envVar: 'FLY_API_TOKEN',
    tokenUrl: 'https://fly.io/user/personal_access_tokens',
    manualSteps: [
      'Install flyctl: winget install Fly.flyctl',
      'Login: flyctl auth login',
      'Create app: flyctl launch',
      'Deploy: flyctl deploy',
    ],
  }),
  meta: {
    id: 'flyio',
    label: 'Fly.io',
    category: 'hosting-backend',
    freeTierNotes: 'Free: 3 shared VMs, 160GB bandwidth/month',
    docsUrl: 'https://fly.io/docs',
  },
};
