import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initState, updateStep, recordResources } from '../state.js';
import { runEnvSync } from '../commands/env-sync.js';

describe('omni env-sync command', () => {
  let tempDir;
  let exitMock;
  let logMock;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-envsync-test-'));
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

  it('exits with code 1 if no state file exists in cwd', async () => {
    await expect(runEnvSync({ cwd: 'D:\\non-existent-env-sync-test-path' })).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('prints message when state has no env vars', async () => {
    initState(tempDir, 'empty-env-app', {});
    await runEnvSync({ cwd: tempDir, live: false });
    expect(logMock).toHaveBeenCalled();
  });

  it('runs dry-run sync for vercel project with env vars', async () => {
    let state = initState(tempDir, 'sync-app', {});
    updateStep(tempDir, state, 'db', {
      status: 'DONE',
      output: { outputs: { DATABASE_URL: 'postgres://localhost/db' } },
    });
    recordResources(tempDir, state, 'vercel', [{ type: 'project', id: 'prj_123' }]);

    await runEnvSync({ cwd: tempDir, live: false });
    expect(logMock).toHaveBeenCalled();
  });
});
