import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as neon from '../providers/database/neon.js';

describe('Neon Provider (Mocked HTTP)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verifies projects list', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ projects: [{ id: 'proj-1' }] }),
    });

    const res = await neon.verify({ token: 'mock-neon-key' });
    expect(res.ok).toBe(true);
    expect(res.account).toContain('1 project(s)');
  });

  it('outputs correct dry-run plan', async () => {
    global.fetch = vi.fn();
    const res = await neon.provision({
      projectName: 'my-app',
      dryRun: true,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[0]).toContain('POST https://console.neon.tech/api/v2/projects');
  });
});
