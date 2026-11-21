/**
 * src/providers/framework/nextjs.js — Next.js scaffolding (real provision)
 */

export const meta = {
  id: 'nextjs',
  label: 'Next.js',
  category: 'framework',
  freeTierNotes: 'Free forever — local only',
  docsUrl: 'https://nextjs.org/docs',
};

export const auth = { type: 'none', envVar: null, tokenInstructions: null, scopesNeeded: [] };

export async function verify() {
  return { ok: true, account: 'local', quotaInfo: 'No limits' };
}

export async function provision(ctx) {
  const { projectName, projectDir, dryRun, verbose } = ctx;

  if (dryRun) {
    return {
      outputs: { FRAMEWORK: 'nextjs' },
      resources: [],
      urls: {},
      dryRunPlan: [
        `npx create-next-app@latest "${projectDir}" --ts --tailwind --app --src-dir --import-alias "@/*" --no-git`,
      ],
    };
  }

  const { execa } = await import('execa');
  await execa('npx', [
    'create-next-app@latest', projectDir,
    '--ts', '--tailwind', '--app', '--src-dir', '--import-alias', '@/*', '--no-git', '--yes',
  ], { stdio: verbose ? 'inherit' : 'pipe' });

  return {
    outputs: { FRAMEWORK: 'nextjs' },
    resources: [],
    urls: {},
  };
}

export async function destroy(ctx) {
  // Local scaffolding only — no remote resources
  return { ok: true };
}
