/**
 * src/providers/hosting-frontend/netlify.js — Netlify stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'netlify',
    label: 'Netlify',
    category: 'hosting-frontend',
    freeTierNotes: 'Free: 100GB bandwidth/month, 300 build minutes/month',
    docsUrl: 'https://docs.netlify.com',
    setupUrl: 'https://app.netlify.com/start',
    envVar: 'NETLIFY_AUTH_TOKEN',
    tokenUrl: 'https://app.netlify.com/user/applications',
    manualSteps: [
      'Install Netlify CLI: npm install -g netlify-cli',
      'Login: netlify login',
      'Init site: netlify init (in project directory)',
      'Deploy: netlify deploy --prod',
    ],
  }),
  meta: {
    id: 'netlify',
    label: 'Netlify',
    category: 'hosting-frontend',
    freeTierNotes: 'Free: 100GB bandwidth/month, 300 build minutes/month',
    docsUrl: 'https://docs.netlify.com',
  },
};
