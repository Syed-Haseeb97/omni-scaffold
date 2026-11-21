/**
 * src/commands/create.js — Main project creation wizard
 *
 * Flow:
 * 1. Ask project name + per-category provider selection
 * 2. Ask provider-specific questions
 * 3. Show plan + confirm
 * 4. Verify credentials for chosen providers
 * 5. Execute DAG
 * 6. Write .env.local + .env.example
 * 7. Write AGENTS.md
 * 8. Print summary
 */

import chalk from 'chalk';
import { join, resolve } from 'path';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { getRegistry, getByCategory } from '../registry.js';
import { executeDag, topologicalSort } from '../dag.js';
import { initState, loadState, updateStep, recordResources } from '../state.js';
import { spinner, printSummary, printError, printWarning, section } from '../progress.js';
import { setJsonMode, setVerbose } from '../progress.js';

const CATEGORY_ORDER = [
  'framework',
  'scm',
  'database',
  'auth',
  'hosting-frontend',
  'hosting-backend',
  'extras',
];

const CATEGORY_LABELS = {
  framework: 'Frontend Framework',
  scm: 'Source Control',
  database: 'Database',
  auth: 'Authentication',
  'hosting-frontend': 'Frontend Hosting',
  'hosting-backend': 'Backend Hosting',
  extras: 'Extras / Add-ons',
};

/**
 * @param {object} opts
 */
export async function runCreate(opts = {}) {
  const {
    name: namePre,
    dryRun = false,
    yes = false,
    config: configFile,
    json: jsonMode = false,
    prompt: aiPrompt,
    resume = false,
    sequential = false,
    live = false,
    verbose = false,
    preConfigObj,
  } = opts;

  setJsonMode(jsonMode);
  setVerbose(verbose);

  const { input, select, checkbox, confirm } = await import('@inquirer/prompts');

  // ── 1. Project name ──────────────────────────────────────────────────────
  let projectName = namePre;
  if (!projectName) {
    projectName = await input({
      message: 'Project name:',
      validate: (v) => {
        if (!v.trim()) return 'Name cannot be empty';
        if (!/^[a-z0-9-]+$/.test(v.trim())) return 'Use only lowercase letters, numbers, hyphens';
        return true;
      },
      transformer: (v) => v.toLowerCase().replace(/\s+/g, '-'),
    });
  }

  projectName = projectName.toLowerCase().trim().replace(/\s+/g, '-');
  const projectDir = resolve(process.cwd(), projectName);

  // ── 2. Load pre-config (from file or --yes mode) ─────────────────────────
  let preConfig = {};
  if (configFile) {
    try {
      const { readFileSync } = await import('fs');
      preConfig = JSON.parse(readFileSync(configFile, 'utf8'));
    } catch (err) {
      printError(`Failed to load config file: ${err.message}`);
      process.exit(1);
    }
  }
  // Allow direct preConfigObj (from omni clone) to override file-based config
  if (preConfigObj && typeof preConfigObj === 'object') {
    preConfig = { ...preConfig, ...preConfigObj };
  }

  // ── 3. Provider selection per category ───────────────────────────────────
  const byCategory = await getByCategory();
  const selectedProviders = {};
  const answers = {};

  section('Stack Selection');

  for (const category of CATEGORY_ORDER) {
    const providers = byCategory[category];
    if (!providers?.length) continue;

    const label = CATEGORY_LABELS[category] || category;
    const isMultiSelect = category === 'extras';

    const choices = providers.map((p) => ({
      name: `${p.meta.label}${p.meta.freeTierNotes ? chalk.gray(` — ${p.meta.freeTierNotes}`) : ''}`,
      value: p.meta.id,
    }));

    if (!isMultiSelect) {
      if (preConfig[category] !== undefined) {
        const val = preConfig[category]?.[0] ?? null;
        if (val) selectedProviders[category] = [val];
        continue;
      }
      if (yes) {
        // In non-interactive mode (--yes), if not specified in preConfig, skip optional categories
        continue;
      }

      // Single select with "None" option for most categories
      const noneOption = { name: chalk.gray('None / Skip'), value: null };
      const allChoices = category === 'scm' || category === 'framework'
        ? choices  // No "None" for framework/scm
        : [noneOption, ...choices];

      let defaultVal = preConfig[category]?.[0] ?? choices[0]?.value;

      const chosen = await select({
        message: `${label}:`,
        choices: allChoices,
        default: defaultVal,
      });

      if (chosen) selectedProviders[category] = [chosen];
    } else {
      if (preConfig[category] !== undefined) {
        if (preConfig[category]?.length > 0) selectedProviders[category] = preConfig[category];
        continue;
      }
      if (yes) {
        continue;
      }

      // Multi-select for extras
      const chosen = await checkbox({
        message: `${label} (optional, select any):`,
        choices,
      });
      if (chosen.length > 0) selectedProviders[category] = chosen;
    }
  }

  // ── 4. Provider-specific questions ────────────────────────────────────────
  const registry = await getRegistry();
  for (const [category, providerIds] of Object.entries(selectedProviders)) {
    for (const id of providerIds) {
      const provider = registry.get(id);
      if (!provider?.questions) continue;
      if (preConfig.answers?.[id]) {
        answers[id] = preConfig.answers[id];
      } else if (dryRun || yes) {
        answers[id] = { region: 'us-east-1', framework: 'vite', visibility: 'private', dbPassword: 'mock-db-password-1234' };
      } else {
        const providerAnswers = await provider.questions({ projectName, projectDir });
        answers[id] = providerAnswers;
      }
    }
  }

  // ── 5. Plan & confirmation ─────────────────────────────────────────────────
  if (!dryRun) {
    console.log(chalk.bold('\n── Project Plan ──────────────────────────────────────'));
    console.log(`  Name:      ${chalk.cyan(projectName)}`);
    console.log(`  Directory: ${chalk.cyan(projectDir)}`);
    for (const [cat, ids] of Object.entries(selectedProviders)) {
      const labels = ids.map((id) => registry.get(id)?.meta.label ?? id).join(', ');
      console.log(`  ${(CATEGORY_LABELS[cat] || cat).padEnd(22)}: ${chalk.cyan(labels)}`);
    }
    if (!live) {
      printWarning('Running in dry-run mode (no real API calls). Pass --live to provision.\n');
    }
    console.log(chalk.bold('──────────────────────────────────────────────────────'));
  }

  if (!yes && !dryRun) {
    const proceed = await confirm({ message: 'Create this project?', default: true });
    if (!proceed) {
      console.log(chalk.gray('Aborted.'));
      return;
    }
  }

  // ── 6. Credential check ───────────────────────────────────────────────────
  if (live && !dryRun) {
    section('Credential Check');
    for (const [cat, ids] of Object.entries(selectedProviders)) {
      for (const id of ids) {
        const provider = registry.get(id);
        if (!provider || provider.auth.type === 'none') continue;
        const result = await provider.verify();
        if (!result.ok) {
          printWarning(`${provider.meta.label}: ${result.quotaInfo}`);
          const { confirm } = await import('@inquirer/prompts');
          const doSetup = await confirm({
            message: `Run setup for ${provider.meta.label}?`,
            default: true,
          });
          if (doSetup) {
            const { runSetup } = await import('./setup.js');
            await runSetup({ provider: id, verbose });
          }
        }
      }
    }
  }

  // ── 7. Build DAG steps ────────────────────────────────────────────────────
  const steps = _buildDag(selectedProviders, projectName, projectDir, registry, answers, { live, dryRun, verbose });

  // ── 8. Load or init state ─────────────────────────────────────────────────
  let state = resume ? loadState(projectDir) : null;
  if (!state) {
    if (!existsSync(projectDir)) mkdirSync(projectDir, { recursive: true });
    state = initState(projectDir, projectName, { selectedProviders, answers });
  }

  // ── 9. Execute ────────────────────────────────────────────────────────────
  const ctx = {
    projectName,
    projectDir,
    answers,
    dryRun: dryRun || !live,
    verbose,
    outputs: {},
  };

  const sp = spinner(`Creating ${projectName}...`);

  const { outputs, failed } = await executeDag(steps, ctx, {
    dryRun: dryRun || !live,
    sequential,
    resume,
    projectDir,
    state,
    onStepStart: (id, label) => sp.update(`${label}...`),
    onStepDone: (id, output) => {
      if (verbose) console.log(chalk.green(`  ✓ ${id}`));
    },
    onStepFail: (id, err) => {
      sp.fail(`Step "${id}" failed: ${err.message}`);
    },
    verbose,
  });

  if (failed.length > 0 && !dryRun && live) {
    sp.fail(`${failed.length} step(s) failed: ${failed.join(', ')}`);
    console.log(chalk.yellow('\nOptions:'));
    console.log('  omni create --resume    — retry failed steps');
    console.log('  omni destroy ' + projectName + '  — roll back everything');
    return;
  }

  sp.succeed(`Project ${projectName} ready!`);

  // ── 10. Write env files ───────────────────────────────────────────────────
  if (!dryRun && live) {
    await _writeEnvFiles(projectDir, outputs);
    await _writeAgentsMd(projectDir, projectName, selectedProviders, outputs, registry);
    await _registerProject(projectName, projectDir, selectedProviders, outputs);
  }

  // ── 12. AI code generation (--prompt) ────────────────────────────────────
  if (aiPrompt && live && !dryRun) {
    const { generateApp } = await import('../ai-gen.js');
    const sp2 = spinner(`Generating starter code from prompt...`);
    try {
      const { files, buildOk } = await generateApp({
        prompt: aiPrompt,
        framework: frameworkIds[0] ?? 'vite-react',
        stack: selectedProviders,
        outDir: projectDir,
        verbose,
      });
      if (buildOk) {
        sp2.succeed(`AI starter code generated! (${files.length} file(s) written, build verified)`);
      } else {
        sp2.fail(`AI codegen failed to produce a clean build after 3 attempts. Check generated files manually.`);
      }
    } catch (err) {
      sp2.fail(`AI codegen error: ${err.message}`);
    }
  }

  // ── 11. Summary ───────────────────────────────────────────────────────────
  const summary = { 'Project': projectName, 'Directory': projectDir };
  for (const stepOutputs of Object.values(outputs)) {
    if (stepOutputs?.urls) {
      for (const [k, v] of Object.entries(stepOutputs.urls)) {
        summary[k] = v;
      }
    }
  }

  if (jsonMode) {
    console.log(JSON.stringify({ project: projectName, outputs, summary }, null, 2));
  } else {
    printSummary(`${projectName} is live!`, {
      Repo: outputs['github-create']?.GITHUB_URL,
      'Live URL': outputs['vercel-deploy']?.VERCEL_URL || outputs['cloudflare-deploy']?.CLOUDFLARE_PAGES_URL,
      Supabase: outputs['supabase-provision']?.urls?.dashboard,
      Database: outputs['neon-provision']?.urls?.dashboard,
    });
    console.log(chalk.gray('Next steps:'));
    console.log(chalk.cyan(`  cd ${projectName}`));
    console.log(chalk.cyan('  npm run dev'));
    console.log();
  }
}

/**
 * Build the dependency-aware step list from selected providers.
 */
function _buildDag(selectedProviders, projectName, projectDir, registry, answers, { live, dryRun, verbose }) {
  const steps = [];

  // Framework scaffold
  const frameworkIds = selectedProviders['framework'] || [];
  if (frameworkIds.length > 0) {
    const fwId = frameworkIds[0];
    steps.push({
      id: 'scaffold',
      label: `Scaffold ${registry.get(fwId)?.meta.label ?? fwId}`,
      provider: 'framework',
      dependsOn: [],
      run: async (ctx) => registry.get(fwId).provision({ ...ctx, answers }),
    });
  }

  // Git + GitHub
  if (selectedProviders['scm']?.includes('github')) {
    steps.push({
      id: 'github-create',
      label: 'Create GitHub repo & push',
      provider: 'github',
      dependsOn: frameworkIds.length > 0 ? ['scaffold'] : [],
      run: async (ctx) => registry.get('github').provision({ ...ctx, answers }),
    });
  }

  // Database
  const dbIds = selectedProviders['database'] || [];
  for (const dbId of dbIds) {
    steps.push({
      id: `${dbId}-provision`,
      label: `Provision ${registry.get(dbId)?.meta.label ?? dbId}`,
      provider: dbId,
      dependsOn: frameworkIds.length > 0 ? ['scaffold'] : [],
      run: async (ctx) => registry.get(dbId).provision({ ...ctx, answers }),
    });
  }

  // Auth (usually bundled with Supabase, so just stub)
  const authIds = selectedProviders['auth'] || [];
  for (const authId of authIds) {
    if (authId !== 'auth-none' && !dbIds.includes('supabase')) {
      steps.push({
        id: `${authId}-provision`,
        label: `Configure ${registry.get(authId)?.meta.label ?? authId}`,
        provider: authId,
        dependsOn: dbIds.map((d) => `${d}-provision`),
        run: async (ctx) => registry.get(authId)?.provision({ ...ctx, answers }) ?? { outputs: {}, resources: [], urls: {} },
      });
    }
  }

  // Frontend hosting
  const hostingFrontendIds = selectedProviders['hosting-frontend'] || [];
  for (const hostId of hostingFrontendIds) {
    steps.push({
      id: `${hostId}-deploy`,
      label: `Deploy to ${registry.get(hostId)?.meta.label ?? hostId}`,
      provider: hostId,
      dependsOn: [
        ...(selectedProviders['scm']?.includes('github') ? ['github-create'] : []),
        ...dbIds.map((d) => `${d}-provision`),
      ],
      run: async (ctx) => registry.get(hostId).provision({ ...ctx, answers }),
    });
  }

  // Backend hosting
  const hostingBackendIds = selectedProviders['hosting-backend'] || [];
  for (const hostId of hostingBackendIds) {
    steps.push({
      id: `${hostId}-deploy`,
      label: `Deploy backend to ${registry.get(hostId)?.meta.label ?? hostId}`,
      provider: hostId,
      dependsOn: selectedProviders['scm']?.includes('github') ? ['github-create'] : [],
      run: async (ctx) => registry.get(hostId).provision({ ...ctx, answers }),
    });
  }

  // Extras
  for (const extraId of selectedProviders['extras'] || []) {
    steps.push({
      id: `${extraId}-provision`,
      label: `Configure ${registry.get(extraId)?.meta.label ?? extraId}`,
      provider: extraId,
      dependsOn: [],
      optional: true,
      run: async (ctx) => registry.get(extraId)?.provision({ ...ctx, answers }) ?? { outputs: {}, resources: [], urls: {} },
    });
  }

  return steps;
}

/**
 * Write .env.local and .env.example from step outputs.
 */
async function _writeEnvFiles(projectDir, allOutputs) {
  const env = {};
  for (const stepOutput of Object.values(allOutputs)) {
    const normalized = _normalizeOutput(stepOutput);
    Object.assign(env, normalized.outputs);
  }

  if (Object.keys(env).length === 0) return;

  const envLines = Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n');
  const exampleLines = Object.keys(env).map((k) => `${k}=`).join('\n');

  writeFileSync(join(projectDir, '.env.local'), envLines + '\n', 'utf8');
  writeFileSync(join(projectDir, '.env.example'), exampleLines + '\n', 'utf8');
}

/**
 * Normalize a provider's step output to { outputs, resources, urls }.
 * Handles both the standard shape and legacy flat-key shapes.
 */
export function _normalizeOutput(raw) {
  if (!raw || typeof raw !== 'object') return { outputs: {}, resources: [], urls: {} };

  if (raw.outputs && typeof raw.outputs === 'object') {
    return {
      outputs: raw.outputs,
      resources: raw.resources || [],
      urls: raw.urls || {},
    };
  }

  // Legacy: flat object with uppercase env-var keys
  const outputs = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^[A-Z][A-Z0-9_]+$/.test(k) && typeof v === 'string') {
      outputs[k] = v;
    }
  }
  return { outputs, resources: [], urls: {} };
}

/**
 * Write AGENTS.md describing the chosen stack.
 */
async function _writeAgentsMd(projectDir, projectName, selectedProviders, outputs, registry) {
  const lines = [
    `# ${projectName} — Agent Context (generated by omni-scaffold)`,
    '',
    '## Stack',
    '',
  ];

  for (const [cat, ids] of Object.entries(selectedProviders)) {
    for (const id of ids) {
      const p = registry.get(id);
      if (!p) continue;
      lines.push(`- **${CATEGORY_LABELS[cat] || cat}**: ${p.meta.label} — [Docs](${p.meta.docsUrl})`);
    }
  }

  lines.push('', '## Rules for AI agents', '');
  lines.push('- Read `.env.example` for required environment variables');
  lines.push('- Do not hardcode any secrets');
  lines.push('- Run `npm run dev` to start the development server');
  lines.push('- Run `npm run build` to build for production');
  lines.push('- State is in `.omni/state.json` (do not edit manually)');

  writeFileSync(join(projectDir, 'AGENTS.md'), lines.join('\n') + '\n', 'utf8');
}

/**
 * Register the project in ~/.omni/projects.json.
 */
async function _registerProject(projectName, projectDir, selectedProviders, outputs) {
  const { loadConfig } = await import('../config.js');
  const { readFileSync, writeFileSync, existsSync } = await import('fs');
  const config = loadConfig();
  const projectsFile = config.projectsFile;

  let projects = [];
  if (existsSync(projectsFile)) {
    try {
      projects = JSON.parse(readFileSync(projectsFile, 'utf8'));
    } catch {}
  }

  const existing = projects.findIndex((p) => p.name === projectName);
  const entry = {
    name: projectName,
    dir: projectDir,
    createdAt: new Date().toISOString(),
    providers: selectedProviders,
    urls: {
      repo: outputs['github-create']?.GITHUB_URL,
      live: outputs['vercel-deploy']?.VERCEL_URL,
    },
  };

  if (existing >= 0) {
    projects[existing] = entry;
  } else {
    projects.push(entry);
  }

  writeFileSync(projectsFile, JSON.stringify(projects, null, 2), 'utf8');
}
