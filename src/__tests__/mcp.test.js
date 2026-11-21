import { describe, it, expect, vi } from 'vitest';

// Mock the registry
vi.mock('../registry.js', () => ({
  getRegistry: async () => new Map([
    ['vite-react', {
      meta: { id: 'vite-react', label: 'Vite + React', category: 'framework' },
      auth: { type: 'none' },
      verify: async () => ({ ok: true }),
      provision: async () => ({}),
      destroy: async () => {},
    }],
  ]),
  getByCategory: async () => ({
    framework: [{ meta: { id: 'vite-react', label: 'Vite + React', category: 'framework', freeTierNotes: 'Free' } }],
  }),
}));

describe('MCP list_providers', () => {
  it('returns all providers as JSON', async () => {
    const { getRegistry } = await import('../registry.js');
    const reg = await getRegistry();
    expect(reg.size).toBe(1);
    expect(reg.get('vite-react').meta.label).toBe('Vite + React');
  });
});

describe('MCP get_stack_options', () => {
  it('returns providers grouped by category', async () => {
    const { getByCategory } = await import('../registry.js');
    const byCat = await getByCategory();
    expect(byCat.framework).toBeDefined();
    expect(byCat.framework[0].meta.id).toBe('vite-react');
  });
});
