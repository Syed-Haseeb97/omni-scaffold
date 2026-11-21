import { describe, it, expect, vi } from 'vitest';
import { generateApp } from '../ai-gen.js';

describe('ai-gen starter generation', () => {
  it('returns empty files and buildOk false when GEMINI_API_KEY is unset', async () => {
    const origKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const res = await generateApp({
        prompt: 'Build a calculator',
        framework: 'vite-react',
        stack: {},
        outDir: 'D:\\non-existent-dir',
      });
      expect(res).toEqual({ files: [], buildOk: false });
    } finally {
      if (origKey) process.env.GEMINI_API_KEY = origKey;
    }
  });
});
