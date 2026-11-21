/**
 * src/commands/mcp.js — MCP Command handler
 */

import { startMcpServer } from '../mcp-server.js';

export async function runMcp() {
  await startMcpServer();
}
