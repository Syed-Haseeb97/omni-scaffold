import { describe, it, expect } from 'vitest';
import { topologicalSort, executeDag } from '../dag.js';

describe('DAG Execution & Topological Sort', () => {
  it('correctly sorts dependencies in topological order', () => {
    const steps = [
      { id: 'deploy', dependsOn: ['db', 'github'] },
      { id: 'scaffold', dependsOn: [] },
      { id: 'github', dependsOn: ['scaffold'] },
      { id: 'db', dependsOn: ['scaffold'] },
    ];

    const sorted = topologicalSort(steps);
    const ids = sorted.map((s) => s.id);

    expect(ids.indexOf('scaffold')).toBeLessThan(ids.indexOf('github'));
    expect(ids.indexOf('scaffold')).toBeLessThan(ids.indexOf('db'));
    expect(ids.indexOf('github')).toBeLessThan(ids.indexOf('deploy'));
    expect(ids.indexOf('db')).toBeLessThan(ids.indexOf('deploy'));
  });

  it('throws on circular dependency', () => {
    const steps = [
      { id: 'step-a', dependsOn: ['step-b'] },
      { id: 'step-b', dependsOn: ['step-a'] },
    ];

    expect(() => topologicalSort(steps)).toThrow(/Circular dependency/);
  });

  it('executes steps and passes context properly', async () => {
    const executed = [];
    const steps = [
      {
        id: 's1',
        label: 'Step 1',
        provider: 'p1',
        dependsOn: [],
        run: async () => {
          executed.push('s1');
          return { val: 1 };
        },
      },
      {
        id: 's2',
        label: 'Step 2',
        provider: 'p2',
        dependsOn: ['s1'],
        run: async (ctx) => {
          executed.push('s2');
          return { val: ctx.outputs.s1.val + 1 };
        },
      },
    ];

    const res = await executeDag(steps, {}, {});
    expect(executed).toEqual(['s1', 's2']);
    expect(res.outputs.s1.val).toBe(1);
    expect(res.outputs.s2.val).toBe(2);
    expect(res.failed).toHaveLength(0);
  });

  it('fails fast and stops scheduling dependent steps on error', async () => {
    const steps = [
      {
        id: 's1',
        label: 'Step 1',
        dependsOn: [],
        run: async () => {
          throw new Error('boom');
        },
      },
      {
        id: 's2',
        label: 'Step 2',
        dependsOn: ['s1'],
        run: async () => {
          return { ok: true };
        },
      },
    ];

    const res = await executeDag(steps, {}, {});
    expect(res.failed).toContain('s1');
    expect(res.skipped).toContain('s2');
  });

  it('skips non-optional downstream steps when failFast is triggered', async () => {
    const steps = [
      {
        id: 'fail-step',
        label: 'Failing Step',
        dependsOn: [],
        optional: false,
        run: async () => {
          throw new Error('primary failure');
        },
      },
      {
        id: 'indep-step',
        label: 'Independent Step',
        dependsOn: [],
        optional: false,
        run: async () => {
          return { ok: true };
        },
      },
    ];

    const res = await executeDag(steps, {}, { sequential: true });
    expect(res.failed).toContain('fail-step');
    expect(res.skipped).toContain('indep-step');
  });

  it('skips already DONE steps when resume is true', async () => {
    const mockState = {
      project: 'test',
      steps: {
        s1: {
          status: 'DONE',
          output: { existingVal: 42 },
        },
      },
    };

    let s1Ran = false;
    let s2Ran = false;

    const steps = [
      {
        id: 's1',
        label: 'Step 1',
        dependsOn: [],
        run: async () => {
          s1Ran = true;
          return { existingVal: 99 };
        },
      },
      {
        id: 's2',
        label: 'Step 2',
        dependsOn: ['s1'],
        run: async (ctx) => {
          s2Ran = true;
          return { fromS1: ctx.outputs.s1?.existingVal };
        },
      },
    ];

    const res = await executeDag(steps, {}, { resume: true, state: mockState });
    expect(s1Ran).toBe(false);
    expect(s2Ran).toBe(true);
    expect(res.skipped).toContain('s1');
    expect(res.outputs.s1.existingVal).toBe(42);
    expect(res.outputs.s2.fromS1).toBe(42);
  });
});
