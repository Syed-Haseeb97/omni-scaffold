import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runStatus } from '../commands/status.js';

describe('omni status command', () => {
  let exitMock;
  let logMock;

  beforeEach(() => {
    exitMock = vi.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    logMock = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    exitMock.mockRestore();
    logMock.mockRestore();
  });

  it('exits with code 1 when no state file is found', async () => {
    await expect(runStatus('non-existent-project-xyz-12345')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });
});
