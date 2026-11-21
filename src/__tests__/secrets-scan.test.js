import { describe, it, expect } from 'vitest';
import { scanContent, generatePrePushHook } from '../secrets-scan.js';

describe('Secrets Scanning', () => {
  it('detects leaked API keys and tokens in code lines', () => {
    const codeWithSecret = `
      const config = {
        githubToken: "ghp_1234567890abcdefghijklmnopqrstuvwxyz",
      };
    `;

    const res = scanContent(codeWithSecret, 'src/api.js');
    expect(res.found).toBe(true);
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches[0].name).toContain('GitHub PAT');
  });

  it('ignores skipped files like .env.example or markdown docs', () => {
    const content = 'API_KEY=your_key_here';
    const res = scanContent(content, '.env.example');
    expect(res.found).toBe(false);
  });

  it('generates a valid pre-push hook script', () => {
    const hook = generatePrePushHook('omni');
    expect(hook).toContain('#!/usr/bin/env node');
    expect(hook).toContain('git diff --cached');
    expect(hook).toContain('PUSH BLOCKED');
  });
});
