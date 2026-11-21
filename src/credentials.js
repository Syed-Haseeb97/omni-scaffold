/**
 * src/credentials.js — Credential storage and masking
 *
 * Primary: Windows Credential Manager via @napi-rs/keyring
 * Fallback: AES-256-GCM encrypted ~/.omni/credentials.enc.json
 *
 * Rules:
 * - Never print secrets in logs
 * - Never write tokens into project directories
 * - mask() must be called on all strings before logging
 */

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from 'fs';
import { join } from 'path';
import os from 'os';

const SERVICE_PREFIX = 'omni-scaffold';
const CREDS_DIR = join(os.homedir(), '.omni');
const CREDS_FILE = join(CREDS_DIR, 'credentials.enc.json');

// Attempt to load keyring (native module)
let Entry = null;
let keyringAvailable = false;
try {
  const mod = await import('@napi-rs/keyring');
  Entry = mod.Entry;
  keyringAvailable = typeof Entry === 'function';
} catch {
  // Will use encrypted JSON fallback
}

// ── Secret registry (in-memory, for masking) ─────────────────────────────────
/** @type {Set<string>} */
const _secrets = new Set();

/**
 * Register a value as a secret to be masked in logs.
 * @param {string} value
 */
export function registerSecret(value) {
  if (value && value.length > 3) _secrets.add(value);
}

/**
 * Mask all registered secrets in a string.
 * @param {string} str
 * @returns {string}
 */
export function mask(str) {
  if (typeof str !== 'string') return str;
  let result = str;
  for (const secret of _secrets) {
    if (secret && secret.length > 3) {
      result = result.replaceAll(secret, '***REDACTED***');
    }
  }
  return result;
}

// ── Keyring operations ────────────────────────────────────────────────────────

/**
 * Store a credential in the OS keyring (or encrypted JSON fallback).
 * @param {string} provider - Provider ID (e.g. "github")
 * @param {string} key - Credential key (e.g. "token")
 * @param {string} value - Secret value
 */
export async function storeCredential(provider, key, value) {
  registerSecret(value);
  const account = `${SERVICE_PREFIX}/${provider}/${key}`;

  if (keyringAvailable) {
    try {
      const entry = new Entry(SERVICE_PREFIX, account);
      entry.setPassword(value);
      return;
    } catch (err) {
      console.warn(`[credentials] keyring unavailable (${err.message}), using fallback`);
    }
  }

  // Fallback: encrypted JSON
  await _encryptedJsonSet(account, value);
}

/**
 * Retrieve a credential.
 * @param {string} provider
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getCredential(provider, key) {
  const account = `${SERVICE_PREFIX}/${provider}/${key}`;

  if (keyringAvailable) {
    try {
      const entry = new Entry(SERVICE_PREFIX, account);
      const val = entry.getPassword();
      if (val) {
        registerSecret(val);
        return val;
      }
    } catch {
      // fall through
    }
  }

  return _encryptedJsonGet(account);
}

/**
 * Delete a stored credential.
 * @param {string} provider
 * @param {string} key
 */
export async function deleteCredential(provider, key) {
  const account = `${SERVICE_PREFIX}/${provider}/${key}`;

  if (keyringAvailable) {
    try {
      const entry = new Entry(SERVICE_PREFIX, account);
      entry.deletePassword();
      return;
    } catch {
      // ignore
    }
  }

  await _encryptedJsonDelete(account);
}

/**
 * Store metadata associated with a provider (e.g. expiresAt).
 * @param {string} provider
 * @param {string} key
 * @param {string} value
 */
export async function storeMetadata(provider, key, value) {
  const account = `${SERVICE_PREFIX}/${provider}/meta:${key}`;
  if (keyringAvailable) {
    try {
      const entry = new Entry(SERVICE_PREFIX, account);
      entry.setPassword(value);
      return;
    } catch {}
  }
  await _encryptedJsonSet(account, value);
}

/**
 * Retrieve metadata associated with a provider.
 * @param {string} provider
 * @param {string} key
 * @returns {Promise<string|null>}
 */
export async function getMetadata(provider, key) {
  const account = `${SERVICE_PREFIX}/${provider}/meta:${key}`;
  if (keyringAvailable) {
    try {
      const entry = new Entry(SERVICE_PREFIX, account);
      const val = entry.getPassword();
      if (val) return val;
    } catch {}
  }
  return _encryptedJsonGet(account);
}

export async function hasCredential(provider, key) {
  const val = await getCredential(provider, key);
  return val !== null && val !== undefined && val !== '';
}

/**
 * Is the keyring natively available?
 * @returns {boolean}
 */
export function isKeyringAvailable() {
  return keyringAvailable;
}

// ── Encrypted JSON fallback ───────────────────────────────────────────────────

/**
 * Derive a machine-local encryption key from hostname + username.
 * This is not security against a targeted attack, but prevents casual reading.
 * @returns {Buffer}
 */
function _deriveKey() {
  const seed = `${os.hostname()}:${os.userInfo().username}:omni-scaffold-v1`;
  return createHash('sha256').update(seed).digest();
}

function _loadEncryptedJson() {
  if (!existsSync(CREDS_FILE)) return {};
  try {
    const raw = readFileSync(CREDS_FILE, 'utf8');
    const store = JSON.parse(raw);
    const key = _deriveKey();
    const result = {};
    for (const [account, encrypted] of Object.entries(store)) {
      try {
        const { iv, tag, data } = encrypted;
        const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
        decipher.setAuthTag(Buffer.from(tag, 'hex'));
        const decrypted = Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]);
        result[account] = decrypted.toString('utf8');
      } catch {
        // Skip corrupted entries
      }
    }
    return result;
  } catch {
    return {};
  }
}

function _saveEncryptedJson(plain) {
  if (!existsSync(CREDS_DIR)) {
    mkdirSync(CREDS_DIR, { recursive: true });
  }
  const key = _deriveKey();
  const encrypted = {};
  for (const [account, value] of Object.entries(plain)) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    encrypted[account] = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      data: data.toString('hex'),
    };
  }
  writeFileSync(CREDS_FILE, JSON.stringify(encrypted, null, 2), 'utf8');
  // Attempt to restrict permissions (best-effort on Windows)
  try {
    chmodSync(CREDS_FILE, 0o600);
  } catch {
    // Windows doesn't fully support POSIX permissions via chmod — acceptable
  }
}

async function _encryptedJsonSet(account, value) {
  const store = _loadEncryptedJson();
  store[account] = value;
  _saveEncryptedJson(store);
}

async function _encryptedJsonGet(account) {
  const store = _loadEncryptedJson();
  const val = store[account] ?? null;
  if (val) registerSecret(val);
  return val;
}

async function _encryptedJsonDelete(account) {
  const store = _loadEncryptedJson();
  delete store[account];
  _saveEncryptedJson(store);
}
