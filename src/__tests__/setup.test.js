import { describe, it, expect, vi } from 'vitest';
import { runSetup } from '../commands/setup.js';

describe('omni setup command', () => {
  it('handles unknown provider gracefully without throwing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runSetup({ provider: 'non-existent-xyz-987' });
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
