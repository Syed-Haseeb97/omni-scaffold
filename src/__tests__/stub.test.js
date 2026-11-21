import { describe, it, expect, vi } from 'vitest';
import * as clerk from '../providers/auth/clerk.js';
import * as stripe from '../providers/extras/stripe.js';
import * as turso from '../providers/database/turso.js';
import * as flyio from '../providers/hosting-backend/flyio.js';

describe('Stub Providers via makeStub', () => {
  it('handles verify with and without token', async () => {
    const noToken = await clerk.verify({});
    expect(noToken.ok).toBe(false);

    const withToken = await clerk.verify({ token: 'sk_test_123' });
    expect(withToken.ok).toBe(true);
  });

  it('runs provision on stub providers and returns instructions', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      const p1 = await stripe.provision({});
      expect(p1.urls.setup).toBeDefined();

      const p2 = await turso.provision({});
      expect(p2.urls.setup).toBeDefined();

      const p3 = await flyio.provision({});
      expect(p3.urls.setup).toBeDefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it('runs destroy on stub provider', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await clerk.destroy({});
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
