/**
 * src/providers/hosting-backend/railway.js — Railway stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'railway',
    label: 'Railway',
    category: 'hosting-backend',
    freeTierNotes: 'Free: $5 credit/month (Hobby plan)',
    docsUrl: 'https://docs.railway.app',
    setupUrl: 'https://railway.app',
    envVar: 'RAILWAY_TOKEN',
    tokenUrl: 'https://railway.app/account/tokens',
    manualSteps: [
      'Install Railway CLI: npm install -g @railway/cli',
      'Login: railway login',
      'Create project: railway init',
      'Deploy: railway up',
    ],
  }),
  meta: {
    id: 'railway',
    label: 'Railway',
    category: 'hosting-backend',
    freeTierNotes: 'Free: \$5 credit/month',
    docsUrl: 'https://docs.railway.app',
  },
};
