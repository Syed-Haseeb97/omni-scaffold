/**
 * src/providers/hosting-frontend/github-pages.js — GitHub Pages stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'github-pages',
    label: 'GitHub Pages',
    category: 'hosting-frontend',
    freeTierNotes: 'Free: 1GB storage, 100GB bandwidth/month',
    docsUrl: 'https://docs.github.com/en/pages',
    setupUrl: 'https://pages.github.com',
    envVar: null,
    manualSteps: [
      'In your GitHub repo, go to Settings > Pages',
      'Set Source to "GitHub Actions" or select a branch',
      'Add a GitHub Actions workflow for your build (e.g. .github/workflows/deploy.yml)',
    ],
  }),
  meta: {
    id: 'github-pages',
    label: 'GitHub Pages',
    category: 'hosting-frontend',
    freeTierNotes: 'Free: 1GB storage, 100GB bandwidth/month',
    docsUrl: 'https://docs.github.com/en/pages',
  },
};
