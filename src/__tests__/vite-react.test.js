import { describe, it, expect } from 'vitest';
import * as viteReact from '../providers/framework/vite-react.js';

describe('Vite + React Provider', () => {
  it('verifies local framework without auth', async () => {
    const res = await viteReact.verify();
    expect(res.ok).toBe(true);
    expect(res.account).toBe('local');
  });

  it('returns comprehensive dry-run plan', async () => {
    const res = await viteReact.provision({
      projectName: 'my-vite-app',
      projectDir: 'D:\\projects\\my-vite-app',
      dryRun: true,
      answers: {
        'vite-react': { styling: 'tailwind', router: true },
      },
    });

    expect(res.dryRunPlan).toBeDefined();
    expect(res.dryRunPlan[0]).toContain('create vite');
    expect(res.resources).toHaveLength(1);
    expect(res.resources[0].type).toBe('directory');
  });

  it('runs destroy without throwing', async () => {
    await expect(viteReact.destroy({ projectDir: 'D:\\tmp' })).resolves.not.toThrow();
  });
});
