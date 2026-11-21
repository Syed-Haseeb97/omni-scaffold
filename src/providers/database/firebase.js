/**
 * src/providers/database/firebase.js — Firebase (Firestore + Auth) provider
 *
 * Uses firebase-tools CLI for all operations.
 * No direct Firebase Management API calls (requires Google Cloud auth + billing).
 *
 * Prerequisites:
 *   - firebase-tools globally installed (npm install -g firebase-tools)
 *   - firebase login (browser OAuth to Google account)
 *
 * Firebase billing note:
 *   - Spark plan (free): unlimited Cloud Firestore reads, 50K writes/day, 1GB storage
 *   - Project creation on Spark is free; some features require Blaze (pay-as-you-go)
 *   - If you hit billing wall, this provider detects it and shows clear steps
 */

import { execa } from 'execa';
import { join } from 'path';

export const meta = {
  id: 'firebase',
  label: 'Firebase (Firestore + Auth)',
  category: 'database',
  freeTierNotes: 'Spark: 50K writes/day, 1GB storage. Some features need Blaze (billing)',
  docsUrl: 'https://firebase.google.com/docs',
};

export const auth = {
  type: 'cli',
  envVar: null,
  cliLogin: 'firebase login',
  tokenUrl: 'https://console.firebase.google.com',
  tokenInstructions: 'Run: firebase login (opens browser)',
  scopesNeeded: ['Firebase Admin'],
};

async function checkFirebaseCli() {
  try {
    await execa('firebase', ['--version'], { reject: false });
    return true;
  } catch {
    return false;
  }
}

export async function verify(creds = {}) {
  const hasFirebase = await checkFirebaseCli();
  if (!hasFirebase) {
    return {
      ok: false,
      account: null,
      quotaInfo: 'firebase-tools not installed. Run: npm install -g firebase-tools',
    };
  }

  try {
    const { stdout, exitCode } = await execa('firebase', ['projects:list', '--json'], {
      reject: false,
    });

    if (exitCode !== 0) {
      return { ok: false, account: null, quotaInfo: 'Not logged in. Run: firebase login' };
    }

    const data = JSON.parse(stdout);
    const count = data.result?.length ?? 0;

    return {
      ok: true,
      account: `${count} Firebase project(s)`,
      quotaInfo: `Spark plan: ${count} projects. Max 5 on Spark (then need Blaze).`,
    };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Error: ${err.message}` };
  }
}

export async function questions(ctx) {
  const { input, select } = await import('@inquirer/prompts');

  const projectId = await input({
    message: 'Firebase project ID (globally unique, e.g. my-app-12345):',
    validate: (v) => /^[a-z0-9-]{6,30}$/.test(v) || 'Must be 6-30 lowercase letters, numbers, hyphens',
  });

  const region = await select({
    message: 'Firestore region:',
    choices: [
      { name: 'us-east1 (South Carolina)', value: 'us-east1' },
      { name: 'us-central1 (Iowa)', value: 'us-central1' },
      { name: 'europe-west1 (Belgium)', value: 'europe-west1' },
      { name: 'asia-south1 (Mumbai)', value: 'asia-south1' },
    ],
    default: 'us-east1',
  });

  return { projectId, region };
}

export async function provision(ctx) {
  const { answers = {}, projectDir, dryRun = false, verbose = false } = ctx;
  const projectId = answers['firebase']?.projectId;
  const region = answers['firebase']?.region ?? 'us-east1';

  if (!projectId) throw new Error('Firebase: projectId is required');

  if (dryRun) {
    return {
      outputs: {},
      resources: [],
      urls: {},
      dryRunPlan: [
        `firebase projects:create ${projectId} --display-name "${projectId}"`,
        `firebase use ${projectId}`,
        `firebase firestore:create --location ${region}`,
      ],
    };
  }

  const hasFirebase = await checkFirebaseCli();
  if (!hasFirebase) {
    throw new Error('firebase-tools not installed. Run: npm install -g firebase-tools');
  }

  // Create project
  try {
    const { stdout, exitCode, stderr } = await execa(
      'firebase',
      ['projects:create', projectId, '--display-name', projectId, '--json'],
      { cwd: projectDir, reject: false }
    );

    if (exitCode !== 0) {
      const errorMsg = stderr || stdout;
      if (errorMsg.includes('already exists')) {
        if (verbose) console.log(`[firebase] Project ${projectId} already exists, continuing`);
      } else if (errorMsg.includes('billing') || errorMsg.includes('quota')) {
        throw new Error(
          `Firebase billing/quota error:\n${errorMsg}\n\n` +
            '  → This may require enabling billing (Blaze plan) on Google Cloud.\n' +
            '  → Visit: https://console.firebase.google.com\n' +
            '  → If on Spark plan, you may have hit the 5-project limit.\n' +
            '  → To check: firebase projects:list'
        );
      } else {
        throw new Error(`Firebase project creation failed: ${errorMsg}`);
      }
    }
  } catch (err) {
    if (err.message.includes('billing') || err.message.includes('quota')) throw err;
    if (err.message.includes('already exists')) {
      if (verbose) console.log('[firebase] Project already exists, continuing');
    } else {
      throw err;
    }
  }

  // Set active project
  await execa('firebase', ['use', projectId], { cwd: projectDir, reject: false });

  // Initialize Firestore (best-effort — may fail if already initialized)
  await execa(
    'firebase',
    ['firestore:create', '--location', region],
    { cwd: projectDir, reject: false }
  );

  // Write firebase.json and .firebaserc
  await _writeFirebaseConfig(projectDir, projectId);

  return {
    outputs: {
      FIREBASE_PROJECT_ID: projectId,
      VITE_FIREBASE_PROJECT_ID: projectId,
    },
    resources: [{ type: 'firebase-project', projectId }],
    urls: {
      dashboard: `https://console.firebase.google.com/project/${projectId}`,
      firestore: `https://console.firebase.google.com/project/${projectId}/firestore`,
    },
  };
}

export async function destroy(ctx, resources) {
  const chalk = (await import('chalk')).default;
  console.log(chalk.yellow('\n⚠  Firebase project deletion requires manual action:'));
  for (const r of resources) {
    if (r.type !== 'firebase-project') continue;
    console.log(chalk.gray(`   → https://console.firebase.google.com/project/${r.projectId}/settings/general`));
    console.log(chalk.gray('   → Scroll to "Delete this project" at the bottom'));
  }
}

async function _writeFirebaseConfig(projectDir, projectId) {
  const { writeFileSync } = await import('fs');

  const firebaseJson = {
    firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
    hosting: {
      public: 'dist',
      ignore: ['firebase.json', '**/.*', '**/node_modules/**'],
      rewrites: [{ source: '**', destination: '/index.html' }],
    },
  };

  const firebaserc = {
    projects: { default: projectId },
  };

  writeFileSync(join(projectDir, 'firebase.json'), JSON.stringify(firebaseJson, null, 2));
  writeFileSync(join(projectDir, '.firebaserc'), JSON.stringify(firebaserc, null, 2));
  writeFileSync(
    join(projectDir, 'firestore.rules'),
    `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`
  );
  writeFileSync(join(projectDir, 'firestore.indexes.json'), JSON.stringify({ indexes: [], fieldOverrides: [] }, null, 2));
}
