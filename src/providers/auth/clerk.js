/**
 * src/providers/auth/clerk.js — Clerk authentication stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'clerk',
    label: 'Clerk',
    category: 'auth',
    freeTierNotes: 'Free: 10K monthly active users',
    docsUrl: 'https://clerk.com/docs',
    setupUrl: 'https://dashboard.clerk.com',
    envVar: 'VITE_CLERK_PUBLISHABLE_KEY',
    tokenUrl: 'https://dashboard.clerk.com/last-active?path=api-keys',
    manualSteps: [
      'Create an application at https://dashboard.clerk.com',
      'Copy the Publishable Key and Secret Key from API Keys',
      'Add VITE_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local',
    ],
  }),
  meta: {
    id: 'clerk',
    label: 'Clerk',
    category: 'auth',
    freeTierNotes: 'Free: 10K monthly active users',
    docsUrl: 'https://clerk.com/docs',
  },
};
