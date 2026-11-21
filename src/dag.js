/**
 * src/dag.js — Dependency-aware step executor
 *
 * Features:
 * - Each step declares dependsOn: string[] of step IDs
 * - p-queue with global concurrency 3, per-provider concurrency 1
 * - Fail-fast: on first failure, stop scheduling new steps, let in-flight finish
 * - --sequential flag: run steps one at a time in topological order
 * - --dry-run: print the DAG without executing
 * - --resume: skip DONE steps (reads from state)
 */

import PQueue from 'p-queue';
import chalk from 'chalk';
import { shouldSkip, updateStep, getStepOutput } from './state.js';

/**
 * @typedef {object} Step
 * @property {string} id - Unique step identifier
 * @property {string} label - Human-readable label
 * @property {string} provider - Provider ID (for per-provider concurrency)
 * @property {string[]} dependsOn - Step IDs that must complete first
 * @property {function(object): Promise<object>} run - Async function, receives context, returns output
 * @property {boolean} [optional] - If true, failure doesn't trigger rollback
 */

/**
 * @typedef {object} DagOptions
 * @property {boolean} [dryRun]
 * @property {boolean} [sequential]
 * @property {boolean} [resume]
 * @property {string} [projectDir]
 * @property {object} [state]
 * @property {function(string, string): void} [onStepStart]
 * @property {function(string, object): void} [onStepDone]
 * @property {function(string, Error): void} [onStepFail]
 * @property {boolean} [verbose]
 */

/**
 * Execute a DAG of steps.
 * @param {Step[]} steps - Topologically ordered (or will be sorted internally)
 * @param {object} ctx - Shared context passed to each step
 * @param {DagOptions} opts
 * @returns {Promise<{ outputs: Record<string, object>, failed: string[], skipped: string[] }>}
 */
export async function executeDag(steps, ctx, opts = {}) {
  const {
    dryRun = false,
    sequential = false,
    resume = false,
    projectDir = process.cwd(),
    state = null,
    onStepStart = () => {},
    onStepDone = () => {},
    onStepFail = () => {},
    verbose = false,
  } = opts;

  // Sort steps topologically
  const sorted = topologicalSort(steps);

  if (dryRun) {
    return _printDryRun(sorted, ctx);
  }

  const outputs = {}; // stepId -> output
  const failed = [];
  const skipped = [];
  let failFast = false;

  // Per-provider queues for rate limiting
  const providerQueues = new Map();
  const globalQueue = new PQueue({ concurrency: sequential ? 1 : 3 });

  /**
   * Get or create a per-provider queue (concurrency: 1).
   */
  function getProviderQueue(provider) {
    if (!providerQueues.has(provider)) {
      providerQueues.set(provider, new PQueue({ concurrency: 1 }));
    }
    return providerQueues.get(provider);
  }

  // Track which steps are complete
  const stepDone = new Map(); // stepId -> Promise
  const stepResolvers = new Map();

  // Create promises for each step so dependents can await them
  for (const step of sorted) {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    promise.catch(() => {}); // Prevent unhandledRejection if no dependent awaits it
    stepDone.set(step.id, promise);
    stepResolvers.set(step.id, { resolve, reject });
  }

  // Schedule each step
  for (const step of sorted) {
    const { resolve, reject } = stepResolvers.get(step.id);

    globalQueue.add(async () => {
      // Wait for all dependencies
      try {
        await Promise.all((step.dependsOn || []).map((depId) => stepDone.get(depId)));
      } catch {
        // A dependency failed — skip this step
        skipped.push(step.id);
        if (state) updateStep(projectDir, state, step.id, { status: 'SKIPPED' });
        resolve(); // Resolve so dependents don't hang forever
        return;
      }

      // Fail-fast: don't start new steps if something has failed
      if (failFast && !step.optional) {
        skipped.push(step.id);
        if (state) updateStep(projectDir, state, step.id, { status: 'SKIPPED' });
        resolve();
        return;
      }

      // Resume: skip DONE steps
      if (resume && state && shouldSkip(state, step.id)) {
        const prevOutput = getStepOutput(state, step.id);
        if (prevOutput) outputs[step.id] = prevOutput;
        skipped.push(step.id);
        resolve();
        return;
      }

      // Build this step's context (include outputs from deps)
      const stepCtx = {
        ...ctx,
        outputs,
        verbose,
      };

      onStepStart(step.id, step.label);
      if (state) updateStep(projectDir, state, step.id, {
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
      });

      // Run via provider queue
      const providerQueue = getProviderQueue(step.provider || 'default');
      try {
        const output = await providerQueue.add(() => step.run(stepCtx));
        outputs[step.id] = output || {};
        if (state) updateStep(projectDir, state, step.id, {
          status: 'DONE',
          completedAt: new Date().toISOString(),
          output: outputs[step.id],
        });
        onStepDone(step.id, outputs[step.id]);
        resolve();
      } catch (err) {
        failed.push(step.id);
        if (state) updateStep(projectDir, state, step.id, {
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          error: err.message,
        });
        onStepFail(step.id, err);
        if (!step.optional) {
          failFast = true;
        }
        reject(err); // propagate to dependents
      }
    });
  }

  await globalQueue.onIdle();

  return { outputs, failed, skipped };
}

/**
 * Topological sort of steps by dependsOn.
 * @param {Step[]} steps
 * @returns {Step[]}
 */
export function topologicalSort(steps) {
  const stepMap = new Map(steps.map((s) => [s.id, s]));
  const visited = new Set();
  const sorted = [];

  function visit(step, inProgress = new Set()) {
    if (inProgress.has(step.id)) {
      throw new Error(`Circular dependency detected involving step: "${step.id}". Check dependsOn chains.`);
    }
    if (visited.has(step.id)) return;
    inProgress.add(step.id);
    for (const depId of (step.dependsOn || [])) {
      const dep = stepMap.get(depId);
      if (dep) visit(dep, new Set(inProgress));
    }
    visited.add(step.id);
    sorted.push(step);
  }

  for (const step of steps) visit(step);
  return sorted;
}

/**
 * Print dry-run plan to console.
 * @param {Step[]} sorted
 * @param {object} ctx
 */
function _printDryRun(sorted, ctx) {
  console.log('\n' + chalk.bold.cyan('── DRY-RUN PLAN ──────────────────────────────────────'));
  let i = 1;
  for (const step of sorted) {
    const deps = step.dependsOn?.length
      ? chalk.gray(` (after: ${step.dependsOn.join(', ')})`)
      : '';
    console.log(
      chalk.yellow(`Step ${String(i).padStart(2)} `) +
        chalk.bold(`[${step.id}]`.padEnd(28)) +
        step.label +
        deps
    );
    i++;
  }
  console.log(chalk.bold.cyan('──────────────────────────────────────────────────────\n'));
  return { outputs: {}, failed: [], skipped: sorted.map((s) => s.id) };
}
