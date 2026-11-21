import { describe, it, expect } from 'vitest';
import * as cfPages from '../providers/hosting-frontend/cloudflare-pages.js';

describe('Cloudflare Pages Provider', () => {
  it('returns dry-run plan correctly', async () => {
    const res = await cfPages.provision({
      projectName: 'my-cf-app',
      projectDir: 'D:\\projects\\my-cf-app',
      dryRun: true,
      answers: {
        'cloudflare-pages': { pagesProjectName: 'my-cf-app' },
      },
    });

    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[0]).toContain('wrangler pages project create');
  });

  it('exposes correct provider metadata', () => {
    expect(cfPages.meta.id).toBe('cloudflare-pages');
    expect(cfPages.meta.category).toBe('hosting-frontend');
    expect(cfPages.auth.type).toBe('cli');
  });
});
