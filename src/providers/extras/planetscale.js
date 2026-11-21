/**
 * src/providers/extras/planetscale.js — PlanetScale MySQL stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'planetscale',
    label: 'PlanetScale (MySQL)',
    category: 'extras',
    freeTierNotes: 'Hobby: 5GB storage, 1B row reads/month (credit card required)',
    docsUrl: 'https://planetscale.com/docs',
    setupUrl: 'https://app.planetscale.com',
    envVar: 'DATABASE_URL',
    tokenUrl: 'https://app.planetscale.com/settings/api-tokens',
    manualSteps: [
      'Create a database at https://app.planetscale.com',
      'Create a branch and promote to production',
      'Create a password in Settings > Passwords',
      'Set DATABASE_URL=mysql://user:pass@host/db?sslaccept=strict in .env.local',
    ],
  }),
  meta: {
    id: 'planetscale',
    label: 'PlanetScale (MySQL)',
    category: 'extras',
    freeTierNotes: 'Hobby: 5GB storage, 1B reads/month',
    docsUrl: 'https://planetscale.com/docs',
  },
};
