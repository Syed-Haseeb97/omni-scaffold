import { describe, it, expect } from 'vitest';
import * as resend from '../providers/extras/resend.js';
import * as upstash from '../providers/extras/upstash.js';
import * as sentry from '../providers/extras/sentry.js';
import * as nextjs from '../providers/framework/nextjs.js';

describe('Promoted Providers (Dry-Run & Verification)', () => {
  it('resend provisions dry-run plan correctly', async () => {
    const res = await resend.provision({ projectName: 'test-app', dryRun: true });
    expect(res.outputs).toHaveProperty('RESEND_API_KEY');
    expect(res.dryRunPlan.length).toBeGreaterThan(0);
  });

  it('upstash provisions dry-run plan correctly', async () => {
    const res = await upstash.provision({ projectName: 'test-app', dryRun: true });
    expect(res.outputs).toHaveProperty('UPSTASH_REDIS_REST_URL');
    expect(res.outputs).toHaveProperty('UPSTASH_REDIS_REST_TOKEN');
    expect(res.dryRunPlan.length).toBeGreaterThan(0);
  });

  it('sentry provisions dry-run plan correctly', async () => {
    const res = await sentry.provision({ projectName: 'test-app', dryRun: true });
    expect(res.outputs).toHaveProperty('SENTRY_DSN');
    expect(res.outputs).toHaveProperty('SENTRY_AUTH_TOKEN');
    expect(res.dryRunPlan.length).toBeGreaterThan(0);
  });

  it('nextjs provisions dry-run plan correctly', async () => {
    const res = await nextjs.provision({ projectName: 'test-app', projectDir: 'D:\\projects\\test-app', dryRun: true });
    expect(res.outputs.FRAMEWORK).toBe('nextjs');
    expect(res.dryRunPlan[0]).toContain('create-next-app');
  });

  it('nextjs verify returns ok', async () => {
    const res = await nextjs.verify();
    expect(res.ok).toBe(true);
  });
});
