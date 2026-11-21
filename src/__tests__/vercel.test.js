import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as vercel from '../providers/hosting-frontend/vercel.js';

describe('Vercel Provider (Mocked HTTP)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verifies authenticated user and plan', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        user: { username: 'testuser', billing: { plan: 'hobby' } },
      }),
    });

    const res = await vercel.verify({ token: 'mock-vc-token' });
    expect(res.ok).toBe(true);
    expect(res.account).toBe('testuser');
    expect(res.quotaInfo).toContain('hobby');
  });

  it('provides dry-run plan with project creation and env injection', async () => {
    global.fetch = vi.fn();
    const res = await vercel.provision({
      projectName: 'my-app',
      dryRun: true,
      outputs: {
        'github-create': { GITHUB_REPO: 'testuser/my-app' },
        'database-provision': { DATABASE_URL: 'postgres://...' },
      },
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[0]).toContain('POST https://api.vercel.com/v10/projects');
    expect(res.dryRunPlan[1]).toContain('DATABASE_URL');
  });
});
