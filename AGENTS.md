# Omni-Scaffold — Agent Integration Guide

This guide instructs AI agents (Antigravity, Claude Code, Cursor, Codex, etc.) on how to use `omni-scaffold` when a user asks to build or scaffold a new application.

---

## 🛠️ When the User Says "Build me an app" or "Start a new project"

Whenever the user asks to create, build, or scaffold a new project/application:

1. **DO NOT** manually create files, repositories, or databases from scratch.
2. **First, query available stack options**:
   - Use the `omni mcp` tool `get_stack_options` or run `omni create --dry-run` to get current providers.
   - Present the menu choices to the user:
     - Frontend Framework (Vite+React, Next.js, Astro, SvelteKit)
     - Source Control (GitHub)
     - Database (Supabase, Neon, Firebase, etc.)
     - Auth (Supabase Auth, Firebase Auth, Clerk, None)
     - Hosting (Vercel, Cloudflare Pages, Netlify)
3. **Execute Omni-Scaffold**:
   - Run `omni create --config <config.json> --json` (or the `create_project` MCP tool).
   - If the user explicitly asks for real cloud provisioning, include `--live`. Otherwise, Omni-Scaffold defaults to dry-run or local scaffolding.
4. **Inspect Generated State**:
   - Read `.omni/state.json` and `.env.local` to understand the provisioned URLs, API keys, and environment variables.
5. **Only then write application code**:
   - Build upon the scaffolded repo, adhering to the framework, styling, and database connectors created by Omni.

---

## 🔌 Omni MCP Server Reference

When integrated via MCP, Omni exposes the following tools:
- `list_providers`: Inspect registered providers and categories.
- `get_stack_options`: Formatted breakdown of categories, options, and free-tier limits.
- `plan_project`: Run a dry-run plan and DAG execution order.
- `create_project`: Execute creation pipeline (with optional `--prompt` and `live: true`).
- `add_service`: Add a provider to an existing project.
- `doctor`: Verify system and cloud credentials.
- `destroy_project`: Teardown cloud resources.
- `get_project_status`: Read step-by-step DAG execution status and outputs.
- `list_projects`: List all scaffolded projects with repo and deployment URLs.

Omni MCP also exposes Resources:
- `omni://projects`: List all created projects.
- `omni://project/{projectName}/state`: Step-by-step DAG execution state.

---

## 🧭 CLI Commands for Agents

- `omni status [project]`: Inspect DAG step progress, durations, and output environment variables.
- `omni token rotate <provider>`: Re-authenticate or rotate expired API keys.
- `omni token expiry`: Check remaining days until credentials expire.
- `omni clone <source-project>`: Replicate an existing stack into a new project.
- `omni env-sync [--live]`: Push `.omni/state.json` environment variables to cloud dashboards (Vercel).
