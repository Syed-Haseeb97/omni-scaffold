/**
 * src/providers/database/turso.js — Turso (SQLite at the edge) stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'turso',
    label: 'Turso (SQLite at the Edge)',
    category: 'database',
    freeTierNotes: 'Free: 500 DBs, 9GB storage, 1B reads/month',
    docsUrl: 'https://docs.turso.tech',
    setupUrl: 'https://app.turso.tech',
    envVar: 'TURSO_DATABASE_URL',
    tokenUrl: 'https://app.turso.tech/settings/api-tokens',
    manualSteps: [
      'Install Turso CLI: winget install ChiselStrike.Turso',
      'Login: turso auth login',
      'Create DB: turso db create <project-name>',
      'Get URL: turso db show <project-name> --url',
      'Create token: turso db tokens create <project-name>',
    ],
  }),
  meta: {
    id: 'turso',
    label: 'Turso (SQLite at the Edge)',
    category: 'database',
    freeTierNotes: 'Free: 500 DBs, 9GB storage, 1B reads/month',
    docsUrl: 'https://docs.turso.tech',
  },
};
