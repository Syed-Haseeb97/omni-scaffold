/**
 * src/providers/scm/github.js — GitHub source control provider
 *
 * API Docs: https://docs.github.com/en/rest/repos/repos
 * Date checked: 2026-11-09
 *
 * Auth strategy (in order):
 *   1. gh CLI — `gh auth token` reads token at runtime (preferred; never stored)
 *   2. Classic PAT pasted manually — stored in keyring as 'github/token'
 *
 * Classic PAT scopes needed: repo (includes create + delete_repo)
 *
 * Full implementation:
 *   - GET /user (verify)
 *   - POST /user/repos (create)
 *   - DELETE /repos/{owner}/{repo} (destroy)
 *   - git init, remote add, push via execa
 */

import { execa } from 'execa';
import { join } from 'path';
import { existsSync, writeFileSync } from 'fs';
import { getCredential, storeCredential, mask } from '../../credentials.js';

const BASE_URL = 'https://api.github.com';
const HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'omni-scaffold/0.1.0',
});

export const meta = {
  id: 'github',
  label: 'GitHub',
  category: 'scm',
  freeTierNotes: 'Free unlimited public & private repos',
  docsUrl: 'https://docs.github.com/en/rest/repos/repos',
};

export const auth = {
  type: 'cli',
  envVar: 'GITHUB_TOKEN',
  cliLogin: 'gh auth login',
  tokenUrl: 'https://github.com/settings/tokens/new',
  tokenInstructions: 'Create a classic PAT with "repo" scope (includes delete_repo)',
  scopesNeeded: ['repo'],
};

/**
 * Get the GitHub token — tries gh CLI first, then stored credential.
 * @returns {Promise<string|null>}
 */
async function getToken() {
  // 1. Try gh CLI
  try {
    const { stdout } = await execa('gh', ['auth', 'token'], { reject: false });
    if (stdout?.trim()) return stdout.trim();
  } catch {
    // gh not available or not logged in
  }

  // 2. Try stored credential
  const stored = await getCredential('github', 'token');
  if (stored) return stored;

  // 3. Try env var
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;

  return null;
}

/**
 * @param {object} creds - { token? }
 * @returns {Promise<{ok: boolean, account: string|null, quotaInfo: string}>}
 */
export async function verify(creds = {}) {
  const token = creds.token || (await getToken());
  if (!token) {
    return { ok: false, account: null, quotaInfo: 'No GitHub token found. Run: gh auth login' };
  }

  try {
    const res = await fetch(`${BASE_URL}/user`, { headers: HEADERS(token) });

    if (res.status === 401) {
      return { ok: false, account: null, quotaInfo: 'Token is invalid or expired' };
    }

    // Check scopes from response header
    const scopes = res.headers.get('X-OAuth-Scopes') || '';
    const data = await res.json();

    return {
      ok: res.ok,
      account: data.login || null,
      quotaInfo: `Scopes: ${scopes || '(using gh CLI — full access)'}`,
    };
  } catch (err) {
    return { ok: false, account: null, quotaInfo: `Network error: ${err.message}` };
  }
}

/**
 * Extra questions for GitHub provider.
 * @param {object} ctx
 */
export async function questions(ctx) {
  const { select } = await import('@inquirer/prompts');
  const visibility = await select({
    message: 'Repository visibility:',
    choices: [
      { name: 'Private', value: 'private' },
      { name: 'Public', value: 'public' },
    ],
  });
  return { visibility };
}

/**
 * Provision: create GitHub repo, init git locally, push to main.
 * @param {object} ctx
 * @returns {Promise<{outputs: object, resources: object[], urls: object}>}
 */
export async function provision(ctx) {
  const {
    projectName,
    projectDir,
    answers = {},
    dryRun = false,
    verbose = false,
    state,
  } = ctx;

  const visibility = answers['github']?.visibility ?? 'private';
  const isPrivate = visibility === 'private';

  if (dryRun) {
    return {
      outputs: {},
      resources: [],
      urls: {},
      dryRunPlan: [
        `POST ${BASE_URL}/user/repos { name: "${projectName}", private: ${isPrivate} }`,
        `git init && git add -A && git commit -m "chore: initial scaffold"`,
        `git remote add origin https://github.com/<user>/${projectName}.git`,
        `git push -u origin main`,
      ],
    };
  }

  const token = await getToken();
  if (!token) {
    throw new Error('GitHub: No token available. Run `gh auth login` or `omni setup --provider github`');
  }

  // Check if repo already exists (idempotent)
  const userRes = await fetch(`${BASE_URL}/user`, { headers: HEADERS(token) });
  const user = await userRes.json();
  const username = user.login;

  const checkRes = await fetch(`${BASE_URL}/repos/${username}/${projectName}`, {
    headers: HEADERS(token),
  });

  let repo;
  if (checkRes.status === 200) {
    // Repo already exists
    repo = await checkRes.json();
    if (verbose) console.log(`[github] Repo ${repo.full_name} already exists, skipping creation`);
  } else {
    // Create the repo
    const createRes = await fetch(`${BASE_URL}/user/repos`, {
      method: 'POST',
      headers: { ...HEADERS(token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: projectName,
        private: isPrivate,
        description: `Created by omni-scaffold`,
        auto_init: false,
      }),
    });

    if (!createRes.ok) {
      const err = await createRes.json().catch(() => ({}));
      throw new Error(`GitHub repo creation failed: ${createRes.status} — ${err.message || JSON.stringify(err.errors)}`);
    }

    repo = await createRes.json();
    if (verbose) console.log(`[github] Created repo: ${repo.full_name}`);
  }

  // Git init and push
  const gitDir = join(projectDir, '.git');
  if (!existsSync(gitDir)) {
    await execa('git', ['init'], { cwd: projectDir });
    await execa('git', ['checkout', '-b', 'main'], { cwd: projectDir });
  }

  // Write global .gitignore template
  _writeGlobalGitignore(projectDir);

  await execa('git', ['add', '-A'], { cwd: projectDir });

  // Check if there are changes to commit
  const { stdout: status } = await execa('git', ['status', '--porcelain'], { cwd: projectDir });
  if (status.trim()) {
    await execa('git', ['commit', '-m', 'chore: initial scaffold via omni-scaffold'], {
      cwd: projectDir,
      env: { ...process.env, GIT_AUTHOR_NAME: username, GIT_COMMITTER_NAME: username },
    });
  }

  // Set up remote (use HTTPS with token for Windows compatibility)
  const remoteUrl = repo.clone_url.replace('https://', `https://oauth2:${token}@`);
  const { stdout: remotes } = await execa('git', ['remote', '-v'], { cwd: projectDir });
  if (!remotes.includes('origin')) {
    await execa('git', ['remote', 'add', 'origin', remoteUrl], { cwd: projectDir });
  } else {
    await execa('git', ['remote', 'set-url', 'origin', remoteUrl], { cwd: projectDir });
  }

  await execa('git', ['push', '-u', 'origin', 'main'], { cwd: projectDir });

  // Reset remote URL to non-token version for safety
  await execa('git', ['remote', 'set-url', 'origin', repo.clone_url], { cwd: projectDir });

  return {
    outputs: {
      GITHUB_REPO: repo.full_name,
      GITHUB_URL: repo.html_url,
      GITHUB_CLONE_URL: repo.clone_url,
      GITHUB_DEFAULT_BRANCH: repo.default_branch || 'main',
    },
    resources: [
      {
        type: 'github-repo',
        owner: username,
        repo: projectName,
        fullName: repo.full_name,
        htmlUrl: repo.html_url,
      },
    ],
    urls: {
      repo: repo.html_url,
    },
  };
}

/**
 * Destroy: delete the GitHub repo.
 * @param {object} ctx
 * @param {object[]} resources
 */
export async function destroy(ctx, resources) {
  const token = await getToken();
  if (!token) throw new Error('GitHub: No token for cleanup');

  for (const resource of resources) {
    if (resource.type !== 'github-repo') continue;

    const { owner, repo } = resource;
    const res = await fetch(`${BASE_URL}/repos/${owner}/${repo}`, {
      method: 'DELETE',
      headers: HEADERS(token),
    });

    if (res.status === 204 || res.status === 404) {
      // 204 = deleted, 404 = already gone
      if (ctx.verbose) console.log(`[github] Deleted repo ${owner}/${repo}`);
    } else {
      throw new Error(`GitHub repo deletion failed: ${res.status}`);
    }
  }
}

/**
 * Write a global .gitignore with secret patterns if not present.
 * @param {string} projectDir
 */
function _writeGlobalGitignore(projectDir) {
  const content = `# Secrets — omni-scaffold pre-push check
.env
.env.local
.env.*.local
*.pem
*.key
credentials.json
credentials.enc.json
.omni/state.json

# Dependencies
node_modules/

# Build outputs
dist/
.next/
.svelte-kit/
out/

# OS
.DS_Store
Thumbs.db
desktop.ini
`;
  const gitignorePath = join(projectDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    writeFileSync(gitignorePath, content, 'utf8');
  }
}
