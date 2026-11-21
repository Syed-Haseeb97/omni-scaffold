import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initState } from '../state.js';
import { runClone } from '../commands/clone.js';

describe('omni clone command', () => {
  let tempDir;
  let exitMock;
  let logMock;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-clone-test-'));
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    exitMock.mockRestore();
    logMock.mockRestore();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exits with code 1 if source project state is not found', async () => {
    await expect(runClone('non-existent-source-app-xyz')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('clones project stack config non-interactively when source exists', async () => {
    initState(tempDir, 'source-app', {
      selectedProviders: {
        framework: ['vite-react'],
        scm: ['github'],
        database: ['neon'],
      },
      answers: {},
    });

    await runClone(tempDir, {
      name: 'cloned-target-app',
      live: false,
      yes: true,
    });

    expect(logMock).toHaveBeenCalled();
  });
});
