import { describe, it, expect } from 'vitest';
import * as firebase from '../providers/database/firebase.js';

describe('Firebase Provider', () => {
  it('throws in provision if projectId is missing', async () => {
    await expect(firebase.provision({ answers: {}, dryRun: true })).rejects.toThrow('projectId is required');
  });

  it('returns dry-run plan when projectId is provided', async () => {
    const res = await firebase.provision({
      dryRun: true,
      answers: {
        firebase: { projectId: 'test-firebase-proj', region: 'us-east1' },
      },
    });

    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[0]).toContain('firebase projects:create test-firebase-proj');
  });
});
