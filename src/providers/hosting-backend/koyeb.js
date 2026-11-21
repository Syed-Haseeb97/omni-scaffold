/**
 * src/providers/hosting-backend/koyeb.js — Koyeb stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'koyeb',
    label: 'Koyeb',
    category: 'hosting-backend',
    freeTierNotes: 'Free: 1 nano instance (256MB RAM, 0.1 CPU)',
    docsUrl: 'https://www.koyeb.com/docs',
    setupUrl: 'https://app.koyeb.com',
    envVar: 'KOYEB_API_KEY',
    tokenUrl: 'https://app.koyeb.com/user/settings/api',
    manualSteps: [
      'Install koyeb CLI: winget install Koyeb.KoyebCLI',
      'Login: koyeb login',
      'Create app: koyeb app create <name>',
      'Deploy: koyeb service create ...',
    ],
  }),
  meta: {
    id: 'koyeb',
    label: 'Koyeb',
    category: 'hosting-backend',
    freeTierNotes: 'Free: 1 nano instance (256MB RAM)',
    docsUrl: 'https://www.koyeb.com/docs',
  },
};
