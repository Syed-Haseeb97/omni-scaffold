/**
 * src/config.js — Global Omni configuration schema and reader
 *
 * Config file: ~/.omni/config.json
 * This stores non-secret settings (AI provider choice, default region, etc.)
 * Secrets are NEVER stored here — see credentials.js.
 */

import { z } from 'zod';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import os from 'os';

const CONFIG_DIR = join(os.homedir(), '.omni');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

export const ConfigSchema = z.object({
  version: z.number().default(1),
  aiProvider: z.enum(['gemini', 'openai', 'anthropic']).default('gemini'),
  defaultRegion: z.string().default('us-east-1'),
  supabaseOrgId: z.string().optional(),
  neonOrgId: z.string().optional(),
  vercelTeamId: z.string().optional(),
  cloudflareAccountId: z.string().optional(),
  githubUsername: z.string().optional(),
  projectsFile: z.string().default(join(CONFIG_DIR, 'projects.json')),
  logLevel: z.enum(['silent', 'info', 'verbose']).default('info'),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/** @typedef {z.infer<typeof ConfigSchema>} OmniConfig */

/**
 * Load the global config (creates default if missing).
 * @returns {OmniConfig}
 */
export function loadConfig() {
  if (!existsSync(CONFIG_FILE)) {
    return ConfigSchema.parse({});
  }
  try {
    const raw = JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
    return ConfigSchema.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ~/.omni/config.json: ${err.message}`);
  }
}

/**
 * Save the global config.
 * @param {Partial<OmniConfig>} updates
 */
export function saveConfig(updates) {
  const current = existsSync(CONFIG_FILE)
    ? JSON.parse(readFileSync(CONFIG_FILE, 'utf8'))
    : {};
  const merged = {
    ...current,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  if (!merged.createdAt) merged.createdAt = new Date().toISOString();
  const validated = ConfigSchema.parse(merged);

  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  writeFileSync(CONFIG_FILE, JSON.stringify(validated, null, 2), 'utf8');
  return validated;
}
