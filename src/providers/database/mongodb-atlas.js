/**
 * src/providers/database/mongodb-atlas.js — MongoDB Atlas stub
 */
import { makeStub } from '../_stub.js';

export const { meta, auth, verify, provision, destroy } = {
  ...makeStub({
    id: 'mongodb-atlas',
    label: 'MongoDB Atlas',
    category: 'database',
    freeTierNotes: 'Free: M0 cluster, 512MB storage, shared',
    docsUrl: 'https://www.mongodb.com/docs/atlas',
    setupUrl: 'https://cloud.mongodb.com',
    envVar: 'MONGODB_URI',
    tokenUrl: 'https://cloud.mongodb.com/v2#/account/publicApi',
    manualSteps: [
      'Create a free M0 cluster at https://cloud.mongodb.com',
      'Add a database user (Database Access > Add New Database User)',
      'Whitelist your IP (Network Access > Add IP Address)',
      'Get the connection string (Clusters > Connect > Connect your application)',
    ],
  }),
  meta: {
    id: 'mongodb-atlas',
    label: 'MongoDB Atlas',
    category: 'database',
    freeTierNotes: 'Free: M0 cluster, 512MB storage',
    docsUrl: 'https://www.mongodb.com/docs/atlas',
  },
};
