import { describe, it, expect, vi } from 'vitest';

vi.mock('../mcp-server.js', () => ({
  startMcpServer: vi.fn().mockResolvedValue(true),
}));

describe('omni mcp command entry', () => {
  it('calls startMcpServer', async () => {
    const { runMcp } = await import('../commands/mcp.js');
    const { startMcpServer } = await import('../mcp-server.js');
    await runMcp();
    expect(startMcpServer).toHaveBeenCalled();
  });
});
