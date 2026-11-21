import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { initState } from '../state.js';
import { startMcpServer } from '../mcp-server.js';
import {
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

describe('startMcpServer instance & handlers', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-mcp-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes MCP server without connecting', async () => {
    initState(tempDir, 'mcp-test-app', {});

    const server = await startMcpServer({ connect: false });
    expect(server).toBeDefined();

    const handlers = server._requestHandlers;
    expect(handlers).toBeDefined();

    // Test ListTools handler
    const listToolsHandler = handlers.get(ListToolsRequestSchema.shape.method.value);
    expect(listToolsHandler).toBeDefined();
    const toolsResult = await listToolsHandler({ method: 'tools/list' });
    expect(toolsResult.tools.length).toBeGreaterThan(5);

    // Test ListResources handler
    const listResHandler = handlers.get(ListResourcesRequestSchema.shape.method.value);
    expect(listResHandler).toBeDefined();
    const resResult = await listResHandler({ method: 'resources/list' });
    expect(resResult.resources.length).toBeGreaterThan(0);

    // Test ReadResource handler
    const readResHandler = handlers.get(ReadResourceRequestSchema.shape.method.value);
    expect(readResHandler).toBeDefined();
    const readResult = await readResHandler({
      method: 'resources/read',
      params: { uri: 'omni://projects' },
    });
    expect(readResult.contents[0].uri).toBe('omni://projects');

    // Test CallTool handlers
    const callToolHandler = handlers.get(CallToolRequestSchema.shape.method.value);
    expect(callToolHandler).toBeDefined();

    // 1. list_providers
    const pRes = await callToolHandler({
      method: 'tools/call',
      params: { name: 'list_providers', arguments: {} },
    });
    expect(pRes.content[0].text).toContain('github');

    // 2. get_stack_options
    const optRes = await callToolHandler({
      method: 'tools/call',
      params: { name: 'get_stack_options', arguments: {} },
    });
    expect(optRes.content[0].text).toContain('framework');

    // 3. plan_project
    const planRes = await callToolHandler({
      method: 'tools/call',
      params: {
        name: 'plan_project',
        arguments: { name: 'sample', config: { framework: ['vite-react'] } },
      },
    });
    expect(planRes.content[0].text).toContain('PLANNED');

    // 4. list_projects
    const lpRes = await callToolHandler({
      method: 'tools/call',
      params: { name: 'list_projects', arguments: {} },
    });
    expect(lpRes.content[0].text).toBeDefined();

    // 5. get_project_status
    const stRes = await callToolHandler({
      method: 'tools/call',
      params: { name: 'get_project_status', arguments: { project: 'non-existent' } },
    });
    expect(stRes.content[0].text).toContain('not found');

    // 6. destroy_project dry-run on existing state
    const destRes = await callToolHandler({
      method: 'tools/call',
      params: { name: 'destroy_project', arguments: { project: tempDir, live: false } },
    });
    expect(destRes.content[0].text).toContain('DESTROYED');
  });
});
