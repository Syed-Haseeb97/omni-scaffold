/**
 * src/mcp-server.js — MCP Server for Omni-Scaffold
 * Runs over stdio, exposing tools to Antigravity and other MCP-enabled agents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import os from 'os';
import { getRegistry, getByCategory, getProvider } from './registry.js';
import { runDoctor } from './commands/doctor.js';
import { runCreate } from './commands/create.js';
import { runAdd } from './commands/add.js';
import { runDestroy } from './commands/destroy.js';

export async function startMcpServer({ connect = true } = {}) {
  const server = new Server(
    {
      name: 'omni-scaffold',
      version: '0.2.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // ── List Tools ────────────────────────────────────────────────────────────
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_providers',
          description: 'List all available infrastructure and framework providers registered in Omni-Scaffold.',
          inputSchema: {
            type: 'object',
            properties: {
              category: {
                type: 'string',
                description: 'Optional category filter: framework, scm, database, auth, hosting-frontend, hosting-backend, extras',
              },
            },
          },
        },
        {
          name: 'get_stack_options',
          description: 'Get structured stack options organized by category with free-tier notes and details for menu presentation.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'plan_project',
          description: 'Generate a dry-run plan and DAG execution order for a project configuration without making real API calls.',
          inputSchema: {
            type: 'object',
            required: ['name', 'config'],
            properties: {
              name: { type: 'string', description: 'Project name' },
              config: {
                type: 'object',
                description: 'Provider selection per category, e.g. { framework: ["vite-react"], scm: ["github"], database: ["supabase"], hosting-frontend: ["vercel"] }',
              },
              prompt: { type: 'string', description: 'Optional prompt for AI code generation' },
            },
          },
        },
        {
          name: 'create_project',
          description: 'Execute project creation (DAG provisioning). Set live=true only if the user explicitly authorizes live cloud resource creation.',
          inputSchema: {
            type: 'object',
            required: ['name', 'config'],
            properties: {
              name: { type: 'string', description: 'Project name' },
              config: { type: 'object', description: 'Provider choices per category' },
              live: { type: 'boolean', description: 'Whether to make real API calls. Defaults to false.' },
              prompt: { type: 'string', description: 'Optional prompt for AI scaffolding' },
            },
          },
        },
        {
          name: 'add_service',
          description: 'Add a new service/provider to an existing project.',
          inputSchema: {
            type: 'object',
            required: ['providerId'],
            properties: {
              providerId: { type: 'string', description: 'ID of the provider to add (e.g., supabase, neon, sentry)' },
              live: { type: 'boolean', description: 'Whether to make real API calls. Defaults to false.' },
            },
          },
        },
        {
          name: 'doctor',
          description: 'Verify credentials and quotas for all registered providers.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'destroy_project',
          description: 'Tear down all cloud resources created for a project.',
          inputSchema: {
            type: 'object',
            required: ['project'],
            properties: {
              project: { type: 'string', description: 'Project name or directory path' },
              live: { type: 'boolean', description: 'Whether to actually delete resources on cloud providers' },
            },
          },
        },
        {
          name: 'get_project_status',
          description: 'Get DAG step status for an omni project.',
          inputSchema: {
            type: 'object',
            required: ['project'],
            properties: {
              project: { type: 'string', description: 'Project name' },
            },
          },
        },
        {
          name: 'list_projects',
          description: 'List all projects created with omni-scaffold and their live URLs.',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  });

  // ── List Resources ─────────────────────────────────────────────────────────
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const projectsFile = join(os.homedir(), '.omni', 'projects.json');
    const resources = [
      {
        uri: 'omni://projects',
        name: 'Omni Projects Registry',
        description: 'All projects created with omni-scaffold and their live URLs',
        mimeType: 'application/json',
      },
    ];

    if (existsSync(projectsFile)) {
      try {
        const projects = JSON.parse(readFileSync(projectsFile, 'utf8'));
        for (const p of projects) {
          const stateFile = join(p.dir, '.omni', 'state.json');
          if (existsSync(stateFile)) {
            resources.push({
              uri: `omni://project/${p.name}/state`,
              name: `${p.name} — DAG State`,
              description: `Step-by-step execution state for project "${p.name}"`,
              mimeType: 'application/json',
            });
          }
        }
      } catch {}
    }

    return { resources };
  });

  // ── Read Resources ─────────────────────────────────────────────────────────
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const projectsFile = join(os.homedir(), '.omni', 'projects.json');

    if (uri === 'omni://projects') {
      const data = existsSync(projectsFile)
        ? readFileSync(projectsFile, 'utf8')
        : '[]';
      return { contents: [{ uri, mimeType: 'application/json', text: data }] };
    }

    const match = uri.match(/^omni:\/\/project\/(.+)\/state$/);
    if (match) {
      const projectName = match[1];
      if (existsSync(projectsFile)) {
        const projects = JSON.parse(readFileSync(projectsFile, 'utf8'));
        const p = projects.find((x) => x.name === projectName);
        if (p) {
          const stateFile = join(p.dir, '.omni', 'state.json');
          if (existsSync(stateFile)) {
            return { contents: [{ uri, mimeType: 'application/json', text: readFileSync(stateFile, 'utf8') }] };
          }
        }
      }
      return { contents: [{ uri, mimeType: 'application/json', text: '{"error":"Project state not found"}' }] };
    }

    throw new Error(`Unknown resource URI: ${uri}`);
  });

  // ── Call Tools ─────────────────────────────────────────────────────────────
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === 'list_providers') {
        const reg = await getRegistry();
        const list = [];
        for (const [id, p] of reg) {
          if (!args?.category || p.meta.category === args.category) {
            list.push({
              id: p.meta.id,
              label: p.meta.label,
              category: p.meta.category,
              freeTier: p.meta.freeTierNotes,
              authType: p.auth.type,
              docsUrl: p.meta.docsUrl,
            });
          }
        }
        return { content: [{ type: 'text', text: JSON.stringify(list, null, 2) }] };
      }

      if (name === 'get_stack_options') {
        const byCat = await getByCategory();
        const res = {};
        for (const [cat, providers] of Object.entries(byCat)) {
          res[cat] = providers.map((p) => ({
            id: p.meta.id,
            label: p.meta.label,
            freeTierNotes: p.meta.freeTierNotes,
            docsUrl: p.meta.docsUrl,
          }));
        }
        return { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }] };
      }

      if (name === 'doctor') {
        const docRes = await runDoctor({ verbose: true });
        return { content: [{ type: 'text', text: JSON.stringify(docRes, null, 2) }] };
      }

      if (name === 'plan_project') {
        const { topologicalSort } = await import('./dag.js');
        const registry = await getRegistry();
        const selectedProviders = args.config || {};
        const projectName = args.name;
        const projectDir = join(os.homedir(), 'projects', projectName); // planning only

        const steps = _buildDagForMcp(selectedProviders, projectName, projectDir, registry);
        const sorted = topologicalSort(steps);

        const plan = sorted.map((s, i) => ({
          step: i + 1,
          id: s.id,
          label: s.label,
          provider: s.provider,
          dependsOn: s.dependsOn,
          optional: s.optional || false,
        }));

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ status: 'PLANNED', name: projectName, config: selectedProviders, executionPlan: plan }, null, 2),
          }],
        };
      }

      if (name === 'create_project') {
        const chunks = [];
        const origWrite = process.stdout.write.bind(process.stdout);
        process.stdout.write = (chunk, ...rest) => {
          chunks.push(typeof chunk === 'string' ? chunk : chunk.toString());
          return origWrite(chunk, ...rest);
        };

        try {
          await runCreate({
            name: args.name,
            config: args.config ? JSON.stringify(args.config) : undefined,
            live: !!args.live,
            yes: true,
            json: true,
            prompt: args.prompt,
            verbose: false,
          });
        } finally {
          process.stdout.write = origWrite;
        }

        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              status: args.live ? 'EXECUTED' : 'DRY_RUN',
              name: args.name,
              live: !!args.live,
              log: chunks.join(''),
            }, null, 2),
          }],
        };
      }

      if (name === 'add_service') {
        await runAdd(args.providerId, { live: !!args.live, yes: true, verbose: false });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ status: 'SERVICE_ADDED', provider: args.providerId, live: !!args.live }, null, 2),
          }],
        };
      }

      if (name === 'destroy_project') {
        await runDestroy(args.project, { live: !!args.live, yes: true, verbose: false });
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ status: 'DESTROYED', project: args.project, live: !!args.live }, null, 2),
          }],
        };
      }

      if (name === 'get_project_status') {
        const projectsFile = join(os.homedir(), '.omni', 'projects.json');
        if (existsSync(projectsFile)) {
          const projects = JSON.parse(readFileSync(projectsFile, 'utf8'));
          const p = projects.find((x) => x.name === args.project);
          if (p) {
            const stateFile = join(p.dir, '.omni', 'state.json');
            if (existsSync(stateFile)) {
              const state = JSON.parse(readFileSync(stateFile, 'utf8'));
              const stepTable = Object.entries(state.steps || {}).map(([id, s]) => ({
                id,
                status: s.status,
                duration: s.startedAt && s.completedAt
                  ? `${((new Date(s.completedAt) - new Date(s.startedAt)) / 1000).toFixed(1)}s`
                  : null,
                error: s.error || null,
              }));
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify({ project: args.project, steps: stepTable, resources: state.resources }, null, 2),
                }],
              };
            }
          }
        }
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ error: `Project "${args.project}" not found or has no state` }, null, 2),
          }],
        };
      }

      if (name === 'list_projects') {
        const projectsFile = join(os.homedir(), '.omni', 'projects.json');
        const data = existsSync(projectsFile)
          ? JSON.parse(readFileSync(projectsFile, 'utf8'))
          : [];
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(data, null, 2),
          }],
        };
      }

      throw new Error(`Tool not found: ${name}`);
    } catch (err) {
      return {
        isError: true,
        content: [{ type: 'text', text: `Error executing ${name}: ${err.message}` }],
      };
    }
  });

  if (connect) {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
  return server;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a label+deps-only DAG for plan_project (no real run functions).
 * Mirrors create.js::_buildDag but with no-op runners.
 */
export function _buildDagForMcp(selectedProviders, projectName, projectDir, registry) {
  const steps = [];
  const frameworkIds = selectedProviders['framework'] || [];

  if (frameworkIds.length > 0) {
    const fwId = frameworkIds[0];
    steps.push({
      id: 'scaffold',
      label: `Scaffold ${registry.get(fwId)?.meta.label ?? fwId}`,
      provider: 'framework',
      dependsOn: [],
      run: async () => ({}),
    });
  }

  if (selectedProviders['scm']?.includes('github')) {
    steps.push({
      id: 'github-create',
      label: 'Create GitHub repo & push',
      provider: 'github',
      dependsOn: frameworkIds.length > 0 ? ['scaffold'] : [],
      run: async () => ({}),
    });
  }

  const dbIds = selectedProviders['database'] || [];
  for (const dbId of dbIds) {
    steps.push({
      id: `${dbId}-provision`,
      label: `Provision ${registry.get(dbId)?.meta.label ?? dbId}`,
      provider: dbId,
      dependsOn: frameworkIds.length > 0 ? ['scaffold'] : [],
      run: async () => ({}),
    });
  }

  for (const authId of selectedProviders['auth'] || []) {
    if (authId !== 'auth-none' && !dbIds.includes('supabase')) {
      steps.push({
        id: `${authId}-provision`,
        label: `Configure ${registry.get(authId)?.meta.label ?? authId}`,
        provider: authId,
        dependsOn: dbIds.map((d) => `${d}-provision`),
        run: async () => ({}),
      });
    }
  }

  for (const hostId of selectedProviders['hosting-frontend'] || []) {
    steps.push({
      id: `${hostId}-deploy`,
      label: `Deploy to ${registry.get(hostId)?.meta.label ?? hostId}`,
      provider: hostId,
      dependsOn: [
        ...(selectedProviders['scm']?.includes('github') ? ['github-create'] : []),
        ...dbIds.map((d) => `${d}-provision`),
      ],
      run: async () => ({}),
    });
  }

  for (const hostId of selectedProviders['hosting-backend'] || []) {
    steps.push({
      id: `${hostId}-deploy`,
      label: `Deploy backend to ${registry.get(hostId)?.meta.label ?? hostId}`,
      provider: hostId,
      dependsOn: selectedProviders['scm']?.includes('github') ? ['github-create'] : [],
      run: async () => ({}),
    });
  }

  for (const extraId of selectedProviders['extras'] || []) {
    steps.push({
      id: `${extraId}-provision`,
      label: `Configure ${registry.get(extraId)?.meta.label ?? extraId}`,
      provider: extraId,
      dependsOn: [],
      optional: true,
      run: async () => ({}),
    });
  }

  return steps;
}
