import { describe, it, expect, vi } from 'vitest';
import { runDoctor } from '../commands/doctor.js';

describe('omni doctor command', () => {
  it('runs doctor and returns results and skipped lists', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    try {
      const res = await runDoctor({ verbose: true });
      expect(res).toHaveProperty('results');
      expect(res).toHaveProperty('skipped');
      expect(res.results.length).toBeGreaterThan(0);
      expect(res.skipped.length).toBeGreaterThan(0);
    } finally {
      logSpy.mockRestore();
      writeSpy.mockRestore();
    }
  });
});
