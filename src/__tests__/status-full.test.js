import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initState, updateStep } from '../state.js';
import { runStatus } from '../commands/status.js';

describe('omni status full test', () => {
  let tempDir;
  let logMock;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-status-test-'));
    logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logMock.mockRestore();
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('prints status successfully for an initialized project with steps', async () => {
    let state = initState(tempDir, 'sample-app', {});
    updateStep(tempDir, state, 'scaffold', {
      status: 'DONE',
      startedAt: new Date(Date.now() - 5000).toISOString(),
      completedAt: new Date().toISOString(),
      output: { FRAMEWORK: 'vite-react', PORT: '5173' },
    });
    updateStep(tempDir, state, 'deploy', {
      status: 'FAILED',
      startedAt: new Date(Date.now() - 2000).toISOString(),
      completedAt: new Date().toISOString(),
      error: 'Deploy connection timeout',
    });

    await runStatus(tempDir, { verbose: true });
    expect(logMock).toHaveBeenCalled();
  });
});
