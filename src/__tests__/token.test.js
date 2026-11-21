import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runToken } from '../commands/token.js';

describe('omni token command', () => {
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

  it('exits with code 1 on unknown action', async () => {
    await expect(runToken('unknown-action', 'github')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('exits with code 1 on rotate with unknown provider', async () => {
    await expect(runToken('rotate', 'unknown-provider-xyz')).rejects.toThrow('process.exit called');
    expect(exitMock).toHaveBeenCalledWith(1);
  });

  it('handles expiry action without throwing', async () => {
    await runToken('expiry');
    expect(logMock).toHaveBeenCalled();
  });
});
