import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initState, recordResources } from '../state.js';
import { runDestroy } from '../commands/destroy.js';

describe('omni destroy command', () => {
  let tempDir;
  let exitMock;
  let logMock;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-destroy-test-'));
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

  it('exits with code 1 when no state found', async () => {
    await expect(runDestroy('non-existent-proj-abc-999')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('runs dry-run destroy successfully when state exists', async () => {
    let state = initState(tempDir, 'destroy-sample', {});
    recordResources(tempDir, state, 'github', [{ type: 'repo', id: '123' }]);

    await runDestroy(tempDir, { yes: true, live: false, verbose: true });
    expect(logMock).toHaveBeenCalled();
  });
});
