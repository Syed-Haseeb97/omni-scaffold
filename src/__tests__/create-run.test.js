import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runCreate } from '../commands/create.js';

describe('omni create command dry-run', () => {
  let logSpy;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('executes dry-run create non-interactively without throwing', async () => {
    await runCreate({
      name: 'dry-test-proj',
      dryRun: true,
      yes: true,
      preConfigObj: {
        framework: ['vite-react'],
        scm: ['github'],
        database: ['neon'],
        'hosting-frontend': ['vercel'],
      },
    });

    expect(logSpy).toHaveBeenCalled();
  });
});
