import { describe, it, expect, vi } from 'vitest';
import * as render from '../providers/hosting-backend/render.js';

describe('Render Provider', () => {
  it('runs verify and returns ok status', async () => {
    const res = await render.verify();
    expect(typeof res.ok).toBe('boolean');
    expect(res).toHaveProperty('quotaInfo');
  });

  it('verifies with valid mocked response', async () => {
    const origFetch = global.fetch;
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ owner: { name: 'Dev Owner' } }],
    });

    try {
      const res = await render.verify({ token: 'rnd_12345' });
      expect(res.ok).toBe(true);
      expect(res.account).toBe('Dev Owner');
    } finally {
      global.fetch = origFetch;
    }
  });
});
