import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as supabase from '../providers/database/supabase.js';

describe('Supabase Provider (Mocked HTTP)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('verifies projects and calculates free quota slots', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'proj1' }],
    });

    const res = await supabase.verify({ token: 'mock-sb-token' });
    expect(res.ok).toBe(true);
    expect(res.quotaInfo).toContain('1/2 projects used');
  });

  it('warns when quota is exhausted (2/2)', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 'p1' }, { id: 'p2' }],
    });

    const res = await supabase.verify({ token: 'mock-sb-token' });
    expect(res.ok).toBe(true);
    expect(res.quotaInfo).toContain('No free slots');
  });

  it('supports dry-run without fetch', async () => {
    global.fetch = vi.fn();
    const res = await supabase.provision({
      projectName: 'my-app',
      dryRun: true,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[1]).toContain('/v1/projects');
  });
});
