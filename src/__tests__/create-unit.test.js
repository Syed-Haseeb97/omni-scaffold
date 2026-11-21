import { describe, it, expect } from 'vitest';
import { _normalizeOutput } from '../commands/create.js';

describe('create.js output normalization', () => {
  it('normalizes standard { outputs, resources, urls } shape', () => {
    const raw = {
      outputs: { VERCEL_URL: 'https://test.vercel.app' },
      resources: [{ type: 'vercel-project', id: '123' }],
      urls: { dashboard: 'https://vercel.com' },
    };
    const norm = _normalizeOutput(raw);
    expect(norm.outputs).toEqual({ VERCEL_URL: 'https://test.vercel.app' });
    expect(norm.resources).toHaveLength(1);
    expect(norm.urls.dashboard).toBe('https://vercel.com');
  });

  it('normalizes legacy flat uppercase object', () => {
    const raw = {
      GITHUB_URL: 'https://github.com/user/repo',
      CLONED: 'true',
      irrelevant_lowercase: 'ignore',
    };
    const norm = _normalizeOutput(raw);
    expect(norm.outputs.GITHUB_URL).toBe('https://github.com/user/repo');
    expect(norm.outputs.CLONED).toBe('true');
    expect(norm.outputs.irrelevant_lowercase).toBeUndefined();
    expect(norm.resources).toEqual([]);
    expect(norm.urls).toEqual({});
  });

  it('handles null, undefined, or primitive input gracefully', () => {
    expect(_normalizeOutput(null)).toEqual({ outputs: {}, resources: [], urls: {} });
    expect(_normalizeOutput(undefined)).toEqual({ outputs: {}, resources: [], urls: {} });
    expect(_normalizeOutput('string')).toEqual({ outputs: {}, resources: [], urls: {} });
    expect(_normalizeOutput(123)).toEqual({ outputs: {}, resources: [], urls: {} });
  });
});
