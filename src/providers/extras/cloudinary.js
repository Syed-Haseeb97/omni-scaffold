/**
 * src/providers/extras/cloudinary.js — Cloudinary media CDN stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'cloudinary',
    label: 'Cloudinary (Media CDN)',
    category: 'extras',
    freeTierNotes: 'Free: 25GB storage, 25GB bandwidth/month',
    docsUrl: 'https://cloudinary.com/documentation',
    setupUrl: 'https://cloudinary.com/console',
    envVar: 'CLOUDINARY_URL',
    tokenUrl: 'https://cloudinary.com/console',
    manualSteps: [
      'Sign up at https://cloudinary.com',
      'Copy the Cloud Name, API Key, and API Secret from the Dashboard',
      'Set CLOUDINARY_URL=cloudinary://api_key:api_secret@cloud_name in .env.local',
    ],
  }),
  meta: {
    id: 'cloudinary',
    label: 'Cloudinary (Media CDN)',
    category: 'extras',
    freeTierNotes: 'Free: 25GB storage + bandwidth',
    docsUrl: 'https://cloudinary.com/documentation',
  },
};
