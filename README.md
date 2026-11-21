# Omni-Scaffold (`omni`)

> Turn the manual work of starting a new full-stack app (GitHub repo, database, hosting, env vars, CI/CD) into one interactive command.

Omni-Scaffold is a Node.js CLI and MCP server built for Windows 11, PowerShell, and modern multi-cloud architectures. It provisions and wires all your stack layers into a unified DAG execution pipeline, verifies credentials and quotas, and integrates directly with AI agent workflows.

---

## 🚀 Features

- **Provider Plugin Architecture**: Every cloud service is a self-contained plugin exporting metadata, authentication hooks, quota checks, idempotent provisioning, and cleanup handlers.
- **DAG Step Execution**: Dependency-aware execution engine with concurrency caps (3 global, 1 per provider) and fail-fast safety.
- **Resume & Rollback**: Records execution state at every step in `.omni/state.json`. Resume failed steps with `--resume` or tear down provisioned resources with `omni destroy`.
- **Pre-Push Secret Shield**: Automatic pre-push git hook prevents accidental leaks of tokens, keys, and credentials.
- **Zero-Plaintext Security**: Secrets are securely managed via the OS credential store (Windows Credential Manager) with AES-256-GCM encrypted fallback. Master tokens are masked in all console logs.
- **Agent First**: Embedded stdio MCP server exposes tools directly to Antigravity and AI coding agents.

---

## 📦 Supported Providers

| Category | Full Real Provisioning | CLI Flows & Stubs |
| :--- | :--- | :--- |
| **Frontend Framework** | **Vite + React** (Tailwind, shadcn/ui, Router), **Next.js** (App Router, TS, Tailwind) | Astro, SvelteKit |
| **Source Control** | **GitHub** (REST API, `gh auth`, push to main) | — |
| **Database** | **Supabase** (Management API + Auth), **Neon** (Serverless Postgres) | Firebase (Firestore + Auth), Turso, MongoDB Atlas, Convex |
| **Auth** | **Supabase Auth** (built-in) | Firebase Auth, Clerk |
| **Frontend Hosting**| **Vercel** (REST API, project linking, env injection, deploy) | Cloudflare Pages (`wrangler`), Netlify, GitHub Pages |
| **Backend Hosting** | — | Render, Railway, Fly.io, Koyeb |
| **Extras** | **Resend** (Email), **Upstash** (Redis REST API), **Sentry** (Error Tracking REST API) | Stripe, Cloudinary, PlanetScale |

---

## 🛠️ Installation & Global Linking

From PowerShell on Windows 11:

```powershell
# Navigate to project directory
cd D:\projects\omni-scaffold

# Install dependencies
npm install

# Link globally
npm link
```

Verify your installation:
```powershell
omni --version
omni --help
```

---

## 🧭 CLI Commands

### `omni doctor`
Verifies all stored credentials against cloud provider APIs, reports account names, and checks free-tier limits:
```powershell
omni doctor
```

### `omni setup`
Interactive wizard to connect your cloud accounts via official CLIs (`gh`, `supabase`, `vercel`, `wrangler`, `firebase`) or pasted API tokens:
```powershell
omni setup
# Or set up a single provider:
omni setup --provider github
```

### `omni create`
Interactive project creation wizard:
```powershell
omni create
```

**Options**:
- `--name <name>`: Predefine project name
- `--dry-run`: Preview the full execution DAG and API calls without executing them
- `--live`: Authorize live cloud API resource creation
- `--yes`: Skip confirmation prompts
- `--config <file.json>`: Load answers from a JSON configuration file
- `--json`: Output machine-readable JSON (ideal for AI agents)
- `--resume`: Resume an interrupted or failed creation process
- `--sequential`: Execute steps one at a time for debugging
- `--prompt "<text>"`: AI starter generation using Gemini 2.5 Flash with iterative build verification

### `omni add <provider>`
Add a database or add-on service to an existing Omni project:
```powershell
omni add neon
omni add resend
```

### `omni list`
View all created projects, active repositories, and live URLs:
```powershell
omni list
```

### `omni status [project]`
Inspect step-by-step DAG execution status, durations, errors, and output env vars:
```powershell
omni status
omni status my-app --verbose
```

### `omni token <action> [provider]`
Manage credentials and track token expiration:
```powershell
omni token expiry
omni token rotate github
```

### `omni clone <source-project>`
Clone an existing project's stack choices and configuration into a new project:
```powershell
omni clone my-existing-app --name new-cloned-app
```

### `omni env-sync`
Sync environment variables recorded in `.omni/state.json` to cloud provider dashboards (e.g., Vercel):
```powershell
omni env-sync          # Dry run
omni env-sync --live   # Push to provider API
```

### `omni destroy <project>`
Tears down all provisioned cloud resources for a project in reverse dependency order:
```powershell
omni destroy my-app --live
```

### `omni mcp`
Launches the stdio Model Context Protocol (MCP) server:
```powershell
omni mcp
```

---

## 🧩 How to Add a Provider Plugin

Adding a service requires only a single file in `src/providers/<category>/<id>.js`:

```javascript
export const meta = {
  id: 'my-service',
  label: 'My Service',
  category: 'database', // framework | scm | database | auth | hosting-frontend | hosting-backend | extras
  freeTierNotes: 'Free forever: 500MB',
  docsUrl: 'https://docs.myservice.com',
};

export const auth = {
  type: 'token', // 'cli' | 'token' | 'none'
  envVar: 'MY_SERVICE_TOKEN',
  tokenUrl: 'https://myservice.com/settings/tokens',
  tokenInstructions: 'Create a read/write token',
  scopesNeeded: ['write'],
};

export async function verify(creds) {
  // Call lightweight endpoint
  return { ok: true, account: 'myuser', quotaInfo: '1/3 used' };
}

export async function questions(ctx) {
  // Optional Inquirer prompts
  return {};
}

export async function provision(ctx) {
  // Idempotent creation
  return {
    outputs: { MY_SERVICE_URL: 'https://...' },
    resources: [{ type: 'service-instance', id: '123' }],
    urls: { dashboard: 'https://...' },
  };
}

export async function destroy(ctx, resources) {
  // Teardown logic
}
```

Omni's registry will automatically discover and integrate the new provider on next run.

---

## ⚠️ Troubleshooting & Caveats

### Supabase Free Project Limit
Supabase allows a maximum of 2 active free projects per organization. `omni doctor` and `omni create` verify your active project count. If you exceed this limit, project creation will fail gracefully with links to your dashboard.

### Firebase Billing & Quotas
- Spark plan projects are limited to 5 projects per account.
- Certain cloud functions and external outbound networking require upgrading to the pay-as-you-go Blaze plan.
- If quota or billing blockers are hit, Omni surfaces clear resolution links rather than failing silently.

### Windows Native Keyring (`@napi-rs/keyring`)
If the native build fails on your Windows machine, Omni automatically and silently falls back to machine-derived AES-256-GCM encrypted storage at `~/.omni/credentials.enc.json`.
