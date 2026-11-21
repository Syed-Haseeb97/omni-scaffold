import { describe, it, expect, beforeEach } from 'vitest';
import { getRegistry, getByCategory, getProvider, resetRegistry } from '../registry.js';

describe('Provider Registry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  it('discovers all registered provider plugins', async () => {
    const reg = await getRegistry();
    expect(reg.size).toBeGreaterThan(10);
    expect(reg.has('github')).toBe(true);
    expect(reg.has('vite-react')).toBe(true);
    expect(reg.has('supabase')).toBe(true);
    expect(reg.has('vercel')).toBe(true);
    expect(reg.has('neon')).toBe(true);
  });

  it('groups providers by category properly', async () => {
    const byCat = await getByCategory();
    expect(byCat).toHaveProperty('framework');
    expect(byCat).toHaveProperty('scm');
    expect(byCat).toHaveProperty('database');
    expect(byCat).toHaveProperty('hosting-frontend');
    expect(byCat).toHaveProperty('hosting-backend');
    expect(byCat).toHaveProperty('extras');

    const scmIds = byCat.scm.map((p) => p.meta.id);
    expect(scmIds).toContain('github');
  });

  it('fetches a single provider by ID', async () => {
    const github = await getProvider('github');
    expect(github.meta.label).toBe('GitHub');
    expect(typeof github.verify).toBe('function');
    expect(typeof github.provision).toBe('function');
    expect(typeof github.destroy).toBe('function');
  });

  it('throws on unknown provider ID', async () => {
    await expect(getProvider('non-existent-provider')).rejects.toThrow('not found in registry');
  });
});
