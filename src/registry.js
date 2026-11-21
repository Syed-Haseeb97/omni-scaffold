/**
 * src/registry.js — Provider plugin auto-discovery
 *
 * Discovers all provider plugins by globbing src/providers/**\/*.js.
 * Each plugin must export: meta, auth, verify, provision, destroy.
 * Optional exports: questions.
 */

import { glob } from 'glob';
import { pathToFileURL, fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROVIDERS_DIR = join(__dirname, 'providers');

/** @type {Map<string, import('./types.js').Provider>} */
let _registry = null;

/**
 * Load and return the provider registry (cached after first call).
 * @returns {Promise<Map<string, import('./types.js').Provider>>}
 */
export async function getRegistry() {
  if (_registry) return _registry;
  _registry = new Map();

  const pattern = '**/*.js';
  const files = await glob(pattern, {
    cwd: PROVIDERS_DIR,
    absolute: true,
    // Ignore index files and test files
    ignore: ['**/*.test.js', '**/index.js', '**/_*.js'],
  });

  const errors = [];
  await Promise.all(
    files.map(async (filePath) => {
      try {
        const mod = await import(pathToFileURL(filePath).href);
        validateProvider(mod, filePath);
        _registry.set(mod.meta.id, mod);
      } catch (err) {
        errors.push({ filePath, err });
      }
    })
  );

  if (errors.length > 0) {
    const msgs = errors.map((e) => `  ${e.filePath}: ${e.err.message}`).join('\n');
    console.warn(`[registry] Warning: failed to load ${errors.length} provider(s):\n${msgs}`);
  }

  return _registry;
}

/**
 * Get providers grouped by category.
 * @returns {Promise<Record<string, import('./types.js').Provider[]>>}
 */
export async function getByCategory() {
  const registry = await getRegistry();
  /** @type {Record<string, import('./types.js').Provider[]>} */
  const byCategory = {};

  for (const provider of registry.values()) {
    const cat = provider.meta.category;
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(provider);
  }

  return byCategory;
}

/**
 * Get a single provider by ID.
 * @param {string} id
 * @returns {Promise<import('./types.js').Provider>}
 */
export async function getProvider(id) {
  const registry = await getRegistry();
  const provider = registry.get(id);
  if (!provider) throw new Error(`Provider "${id}" not found in registry`);
  return provider;
}

/**
 * Validate that a module exports the required provider shape.
 * @param {object} mod
 * @param {string} filePath
 */
function validateProvider(mod, filePath) {
  const required = ['meta', 'auth', 'verify', 'provision', 'destroy'];
  for (const key of required) {
    if (!(key in mod)) {
      throw new Error(`Missing export "${key}" in ${filePath}`);
    }
  }
  if (!mod.meta.id) throw new Error(`meta.id is required in ${filePath}`);
  if (!mod.meta.category) throw new Error(`meta.category is required in ${filePath}`);
  if (!mod.meta.label) throw new Error(`meta.label is required in ${filePath}`);
}

/**
 * Reset the registry cache (for testing).
 */
export function resetRegistry() {
  _registry = null;
}
