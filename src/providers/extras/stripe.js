/**
 * src/providers/extras/stripe.js — Stripe test-mode keys stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'stripe',
    label: 'Stripe (Payments)',
    category: 'extras',
    freeTierNotes: 'Free test mode; 2.9% + 30¢ per transaction in live mode',
    docsUrl: 'https://stripe.com/docs',
    setupUrl: 'https://dashboard.stripe.com/apikeys',
    envVar: 'STRIPE_SECRET_KEY',
    tokenUrl: 'https://dashboard.stripe.com/apikeys',
    manualSteps: [
      'Get test-mode keys from https://dashboard.stripe.com/apikeys',
      'Set STRIPE_SECRET_KEY=sk_test_... and VITE_STRIPE_PUBLISHABLE_KEY=pk_test_... in .env.local',
      'Never use live keys in development',
    ],
  }),
  meta: {
    id: 'stripe',
    label: 'Stripe (Payments)',
    category: 'extras',
    freeTierNotes: 'Free test mode; 2.9%+30¢ per transaction live',
    docsUrl: 'https://stripe.com/docs',
  },
};
