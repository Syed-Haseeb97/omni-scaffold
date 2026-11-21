/**
 * src/secrets-scan.js — Secret scanner for pre-push git hooks
 *
 * Scans staged files for common secret patterns and blocks pushes
 * if any are found. Installed as a git hook during `omni create`.
 */

/** Common secret patterns */
const PATTERNS = [
  { name: 'Generic API Key', regex: /['"]?[Aa][Pp][Ii][_-]?[Kk][Ee][Yy]['"]?\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]/ },
  { name: 'GitHub PAT (classic)', regex: /ghp_[a-zA-Z0-9]{36}/ },
  { name: 'GitHub PAT (fine-grained)', regex: /github_pat_[a-zA-Z0-9_]{82}/ },
  { name: 'Supabase access token', regex: /sbp_[a-zA-Z0-9]{40}/ },
  { name: 'Supabase service role key', regex: /eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/ },
  { name: 'Vercel token', regex: /[a-zA-Z0-9]{24}/ }, // too generic, needs context
  { name: 'Neon API key', regex: /neon_[a-zA-Z0-9_]{40,}/ },
  { name: 'Stripe secret key', regex: /sk_(live|test)_[a-zA-Z0-9]{24,}/ },
  { name: 'Stripe publishable key', regex: /pk_(live|test)_[a-zA-Z0-9]{24,}/ },
  { name: 'Cloudflare API token', regex: /[a-zA-Z0-9_-]{40}/ }, // needs context
  { name: 'Private key PEM', regex: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/ },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/ },
  { name: 'Generic bearer token', regex: /[Bb]earer\s+[a-zA-Z0-9_\-\.]{20,}/ },
  { name: '.env variable assignment', regex: /^[A-Z_]+(SECRET|KEY|TOKEN|PASSWORD|PASS|PWD)\s*=\s*.+$/m },
];

// Files to always skip
const SKIP_FILES = [
  '.env.example',
  '.env.sample',
  '.env.template',
  'BROWSER_TASKS.md',
  'README.md',
  'secrets-scan.js', // This file itself
];

/**
 * Scan text content for secrets.
 * @param {string} content - File content
 * @param {string} filename - Filename (for skip list check)
 * @returns {{ found: boolean, matches: Array<{name: string, line: number}> }}
 */
export function scanContent(content, filename = '') {
  const basename = filename.split('/').pop().split('\\').pop();
  if (SKIP_FILES.includes(basename)) {
    return { found: false, matches: [] };
  }

  const lines = content.split('\n');
  const matches = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Skip comment lines and example values
    if (line.trim().startsWith('#') || line.includes('your_') || line.includes('xxx') || line.includes('placeholder')) {
      continue;
    }
    for (const pattern of PATTERNS) {
      if (pattern.regex.test(line)) {
        matches.push({ name: pattern.name, line: i + 1, snippet: line.substring(0, 60) + '...' });
        break; // One match per line is enough
      }
    }
  }

  return { found: matches.length > 0, matches };
}

/**
 * Generate the git pre-push hook script content.
 * @param {string} omniCliPath - Absolute path to the omni CLI
 * @returns {string} Hook script content
 */
export function generatePrePushHook(omniCliPath) {
  return `#!/usr/bin/env node
/**
 * Git pre-push hook — installed by omni-scaffold
 * Scans staged files for leaked secrets before pushing.
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

const PATTERNS = ${JSON.stringify(PATTERNS.map((p) => ({ name: p.name, regex: p.regex.source })), null, 2)};

try {
  const diff = execSync('git diff --cached --name-only', { encoding: 'utf8' });
  const files = diff.trim().split('\\n').filter(Boolean);
  const violations = [];

  for (const file of files) {
    try {
      const content = readFileSync(file, 'utf8');
      const lines = content.split('\\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim().startsWith('#')) continue;
        for (const { name, regex } of PATTERNS) {
          if (new RegExp(regex).test(line)) {
            violations.push(\`  \${file}:\${i + 1} — \${name}\`);
            break;
          }
        }
      }
    } catch { /* binary file or unreadable */ }
  }

  if (violations.length > 0) {
    console.error('\\n🔴 PUSH BLOCKED: Potential secrets detected:\\n');
    violations.forEach((v) => console.error(v));
    console.error('\\n  Run \`git diff --cached\` to review.');
    console.error('  Add false positives to .gitignore or use git-secrets allowlist.');
    process.exit(1);
  }
} catch (err) {
  // Don't block push if hook itself errors
  process.exit(0);
}
`;
}
