import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  initState,
  loadState,
  updateStep,
  shouldSkip,
  getStepOutput,
  recordResources,
  getFailedSteps,
} from '../state.js';

describe('State Management', () => {
  let tempDir;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'omni-state-test-'));
  });

  afterEach(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes and loads state correctly', () => {
    const plan = { test: true };
    const state = initState(tempDir, 'test-app', plan);
    expect(state.project).toBe('test-app');
    expect(state.plan).toEqual(plan);

    const loaded = loadState(tempDir);
    expect(loaded).not.toBeNull();
    expect(loaded.project).toBe('test-app');
  });

  it('returns null when loading state from non-existent directory', () => {
    const loaded = loadState(join(tempDir, 'does-not-exist'));
    expect(loaded).toBeNull();
  });

  it('updates step progress and tracks outputs', () => {
    let state = initState(tempDir, 'test-app', {});
    state = updateStep(tempDir, state, 'scaffold', {
      status: 'DONE',
      output: { FRAMEWORK: 'vite-react' },
    });

    expect(shouldSkip(state, 'scaffold')).toBe(true);
    expect(getStepOutput(state, 'scaffold')).toEqual({ FRAMEWORK: 'vite-react' });
  });

  it('records provider resources for teardown', () => {
    let state = initState(tempDir, 'test-app', {});
    const res = [{ type: 'github-repo', name: 'test-app' }];
    state = recordResources(tempDir, state, 'github', res);

    expect(state.resources.github).toEqual(res);
  });

  it('correctly filters failed steps with getFailedSteps', () => {
    let state = initState(tempDir, 'test-app', {});
    updateStep(tempDir, state, 'step1', { status: 'DONE' });
    updateStep(tempDir, state, 'step2', { status: 'FAILED', error: 'Database error' });
    updateStep(tempDir, state, 'step3', { status: 'SKIPPED' });
    updateStep(tempDir, state, 'step4', { status: 'FAILED', error: 'Network error' });

    const failed = getFailedSteps(state);
    expect(failed).toEqual(['step2', 'step4']);
  });
});
