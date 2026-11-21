import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as github from '../providers/scm/github.js';

describe('GitHub Provider (Mocked HTTP)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verifies a valid token via /user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ 'X-OAuth-Scopes': 'repo, delete_repo' }),
      json: async () => ({ login: 'octocat' }),
    });

    const res = await github.verify({ token: 'mock-token' });
    expect(res.ok).toBe(true);
    expect(res.account).toBe('octocat');
    expect(res.quotaInfo).toContain('repo, delete_repo');
  });

  it('handles 401 unauthorized gracefully', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: new Headers(),
      json: async () => ({ message: 'Bad credentials' }),
    });

    const res = await github.verify({ token: 'bad-token' });
    expect(res.ok).toBe(false);
    expect(res.quotaInfo).toContain('invalid or expired');
  });

  it('returns a dry-run plan without calling fetch', async () => {
    global.fetch = vi.fn();
    const res = await github.provision({
      projectName: 'my-app',
      projectDir: 'D:/tmp/my-app',
      dryRun: true,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[0]).toContain('POST https://api.github.com/user/repos');
  });
});
