/**
 * src/providers/framework/vite-react.js — Vite + React scaffolding
 *
 * Uses `npm create vite@latest` via execa (Windows-safe).
 * No API calls needed — purely local scaffolding.
 */

import { execa } from 'execa';
import { join } from 'path';
import { existsSync } from 'fs';

export const meta = {
  id: 'vite-react',
  label: 'Vite + React',
  category: 'framework',
  freeTierNotes: 'Free forever — local only',
  docsUrl: 'https://vitejs.dev/guide/',
};

export const auth = {
  type: 'none',
  envVar: null,
  tokenInstructions: null,
  scopesNeeded: [],
};

export async function verify() {
  // No auth required
  return { ok: true, account: 'local', quotaInfo: 'No limits' };
}

export async function questions(ctx) {
  const { select, confirm } = await import('@inquirer/prompts');

  const styling = await select({
    message: 'Styling add-ons:',
    choices: [
      { name: 'Tailwind CSS', value: 'tailwind' },
      { name: 'Tailwind + shadcn/ui', value: 'shadcn' },
      { name: 'Plain CSS', value: 'none' },
    ],
  });

  const router = await confirm({
    message: 'Add React Router v6?',
    default: true,
  });

  return { styling, router };
}

export async function provision(ctx) {
  const { projectName, projectDir, answers = {}, dryRun = false, verbose = false } = ctx;
  const styling = answers['vite-react']?.styling ?? 'tailwind';
  const addRouter = answers['vite-react']?.router ?? true;

  if (dryRun) {
    return {
      outputs: {},
      resources: [{ type: 'directory', path: projectDir }],
      urls: {},
      dryRunPlan: [
        `npm create vite@latest "${projectName}" -- --template react`,
        `cd "${projectDir}" && npm install`,
        styling !== 'none' ? 'npm install -D tailwindcss postcss autoprefixer && npx tailwindcss init -p' : null,
        styling === 'shadcn' ? 'npx shadcn-ui@latest init' : null,
        addRouter ? 'npm install react-router-dom' : null,
      ].filter(Boolean),
    };
  }

  // Check if already scaffolded (idempotent)
  if (existsSync(join(projectDir, 'package.json'))) {
    if (verbose) console.log('[vite-react] Already scaffolded, skipping');
    return { outputs: {}, resources: [{ type: 'directory', path: projectDir }], urls: {} };
  }

  const parentDir = join(projectDir, '..');

  // Create Vite + React app
  await execa('npm', ['create', 'vite@latest', projectName, '--', '--template', 'react'], {
    cwd: parentDir,
    stdio: verbose ? 'inherit' : 'pipe',
  });

  // Install base dependencies
  await execa('npm', ['install'], {
    cwd: projectDir,
    stdio: verbose ? 'inherit' : 'pipe',
  });

  // Add Tailwind
  if (styling !== 'none') {
    await execa('npm', ['install', '-D', 'tailwindcss', 'postcss', 'autoprefixer'], {
      cwd: projectDir,
      stdio: verbose ? 'inherit' : 'pipe',
    });
    await execa('npx', ['tailwindcss', 'init', '-p'], {
      cwd: projectDir,
      stdio: verbose ? 'inherit' : 'pipe',
    });
    // Write tailwind.config.js with content glob
    await _writeTailwindConfig(projectDir);
    // Update index.css with Tailwind directives
    await _writeTailwindCss(projectDir);
  }

  // Add shadcn/ui
  if (styling === 'shadcn') {
    await execa('npx', ['shadcn-ui@latest', 'init', '--yes'], {
      cwd: projectDir,
      stdio: verbose ? 'inherit' : 'pipe',
    });
  }

  // Add React Router
  if (addRouter) {
    await execa('npm', ['install', 'react-router-dom'], {
      cwd: projectDir,
      stdio: verbose ? 'inherit' : 'pipe',
    });
  }

  return {
    outputs: { FRAMEWORK: 'vite-react' },
    resources: [{ type: 'directory', path: projectDir }],
    urls: {},
  };
}

export async function destroy(ctx, resources) {
  // Local scaffold — just inform; actual delete is done by omni destroy at the project level
  const chalk = (await import('chalk')).default;
  console.log(chalk.gray('[vite-react] Local directory cleanup is handled by the destroy command'));
}

async function _writeTailwindConfig(projectDir) {
  const { writeFileSync } = await import('fs');
  const content = `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`;
  writeFileSync(join(projectDir, 'tailwind.config.js'), content, 'utf8');
}

async function _writeTailwindCss(projectDir) {
  const { writeFileSync } = await import('fs');
  const content = `@tailwind base;
@tailwind components;
@tailwind utilities;
`;
  writeFileSync(join(projectDir, 'src', 'index.css'), content, 'utf8');
}
