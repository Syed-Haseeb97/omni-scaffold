/**
 * src/state.js — Project step state management
 *
 * Writes/reads .omni/state.json in the project directory.
 * Used for resume logic: --resume flag skips DONE steps.
 *
 * State shape:
 * {
 *   version: 1,
 *   project: "my-app",
 *   createdAt: "ISO",
 *   updatedAt: "ISO",
 *   plan: { providers: {...}, config: {...} },
 *   steps: {
 *     "step-id": {
 *       status: "PENDING" | "RUNNING" | "DONE" | "FAILED" | "SKIPPED",
 *       startedAt?: "ISO",
 *       completedAt?: "ISO",
 *       output?: object,   // returned from step (env vars, URLs, resources)
 *       error?: string
 *     }
 *   }
 * }
 */

import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const STATE_DIR = '.omni';
const STATE_FILE = 'state.json';

/** @typedef {'PENDING'|'RUNNING'|'DONE'|'FAILED'|'SKIPPED'} StepStatus */

/**
 * @typedef {object} StepState
 * @property {StepStatus} status
 * @property {string} [startedAt]
 * @property {string} [completedAt]
 * @property {object} [output]
 * @property {string} [error]
 */

/**
 * @typedef {object} ProjectState
 * @property {number} version
 * @property {string} project
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {object} plan
 * @property {Record<string, StepState>} steps
 * @property {object} [resources]  - provider-keyed resource handles for destroy()
 */

/**
 * Load project state from .omni/state.json (relative to cwd).
 * @param {string} projectDir
 * @returns {ProjectState|null}
 */
export function loadState(projectDir) {
  const stateFile = join(projectDir, STATE_DIR, STATE_FILE);
  if (!existsSync(stateFile)) return null;
  try {
    return JSON.parse(readFileSync(stateFile, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Initialize fresh project state.
 * @param {string} projectDir
 * @param {string} projectName
 * @param {object} plan
 * @returns {ProjectState}
 */
export function initState(projectDir, projectName, plan) {
  const state = {
    version: 1,
    project: projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    plan,
    steps: {},
    resources: {},
  };
  _writeState(projectDir, state);
  return state;
}

/**
 * Update a step's status and optional output/error.
 * @param {string} projectDir
 * @param {ProjectState} state
 * @param {string} stepId
 * @param {Partial<StepState>} update
 * @returns {ProjectState}
 */
export function updateStep(projectDir, state, stepId, update) {
  if (!state.steps[stepId]) {
    state.steps[stepId] = { status: 'PENDING' };
  }
  Object.assign(state.steps[stepId], update);
  state.updatedAt = new Date().toISOString();
  _writeState(projectDir, state);
  return state;
}

/**
 * Record provider resources for later destroy().
 * @param {string} projectDir
 * @param {ProjectState} state
 * @param {string} provider
 * @param {object[]} resources
 * @returns {ProjectState}
 */
export function recordResources(projectDir, state, provider, resources) {
  if (!state.resources) state.resources = {};
  state.resources[provider] = resources;
  state.updatedAt = new Date().toISOString();
  _writeState(projectDir, state);
  return state;
}

/**
 * Check if a step should be skipped (already DONE) in --resume mode.
 * @param {ProjectState} state
 * @param {string} stepId
 * @returns {boolean}
 */
export function shouldSkip(state, stepId) {
  return state?.steps?.[stepId]?.status === 'DONE';
}

/**
 * Get the output from a completed step.
 * @param {ProjectState} state
 * @param {string} stepId
 * @returns {object|null}
 */
export function getStepOutput(state, stepId) {
  return state?.steps?.[stepId]?.output ?? null;
}

/**
 * Get all FAILED steps.
 * @param {ProjectState} state
 * @returns {string[]}
 */
export function getFailedSteps(state) {
  return Object.entries(state.steps || {})
    .filter(([, s]) => s.status === 'FAILED')
    .map(([id]) => id);
}

function _writeState(projectDir, state) {
  const dir = join(projectDir, STATE_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const target = join(dir, STATE_FILE);
  const tmp = target + '.tmp';
  writeFileSync(tmp, JSON.stringify(state, null, 2), 'utf8');
  try {
    renameSync(tmp, target);
  } catch {
    writeFileSync(target, JSON.stringify(state, null, 2), 'utf8');
  }
}
