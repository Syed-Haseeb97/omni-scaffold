import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initState } from '../state.js';
import { runAdd } from '../commands/add.js';

describe('omni add command', () => {
  let tempDir;
  let exitMock;
  let logMock;
  let origCwd;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-add-test-'));
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
    origCwd = process.cwd();
  });

  afterEach(() => {
    process.chdir(origCwd);
    exitMock.mockRestore();
    logMock.mockRestore();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('exits with code 1 if no state file exists in cwd', async () => {
    process.chdir(tempDir);
    await expect(runAdd('upstash')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 for unknown provider', async () => {
    initState(tempDir, 'sample-app', {});
    process.chdir(tempDir);
    await expect(runAdd('unknown-provider-xyz-123')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('runs dryRun add successfully for valid provider', async () => {
    initState(tempDir, 'sample-app', {});
    process.chdir(tempDir);
    await runAdd('upstash', { dryRun: true });
    expect(logMock).toHaveBeenCalled();
  });
});
