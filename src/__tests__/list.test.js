import { describe, it, expect, vi } from 'vitest';
import { runList } from '../commands/list.js';

describe('omni list command', () => {
  it('runs without throwing', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    try {
      await runList();
      await runList({ json: true });
      expect(logSpy).toHaveBeenCalled();
    } finally {
      logSpy.mockRestore();
    }
  });
});
