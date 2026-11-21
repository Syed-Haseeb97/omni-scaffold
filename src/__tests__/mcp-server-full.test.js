import { describe, it, expect, vi } from 'vitest';
import { _buildDagForMcp } from '../mcp-server.js';
import { getRegistry } from '../registry.js';

describe('MCP Server handlers & DAG builder', () => {
  it('builds DAG for MCP plan correctly across categories', async () => {
    const registry = await getRegistry();
    const config = {
      framework: ['vite-react'],
      scm: ['github'],
      database: ['neon'],
      auth: ['clerk'],
      'hosting-frontend': ['vercel'],
      'hosting-backend': ['render'],
      extras: ['upstash', 'resend'],
    };

    const steps = _buildDagForMcp(config, 'mcp-plan-app', 'D:\\projects\\mcp-plan-app', registry);
    expect(steps.length).toBeGreaterThan(5);

    const stepIds = steps.map((s) => s.id);
    expect(stepIds).toContain('scaffold');
    expect(stepIds).toContain('github-create');
    expect(stepIds).toContain('neon-provision');
    expect(stepIds).toContain('vercel-deploy');
    expect(stepIds).toContain('upstash-provision');

    // Run no-op runner
    const res = await steps[0].run({});
    expect(res).toEqual({});
  });
});
