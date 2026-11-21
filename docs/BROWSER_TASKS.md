# Browser-Assisted Setup Tasks (`docs/BROWSER_TASKS.md`)

This guide contains precise, step-by-step navigation scripts for generating access tokens across supported providers.
Follow these scripts when setting up credentials for `omni-scaffold`.

> [!SECURITY]
> **Safety Rules**:
> 1. The user must manually type passwords, submit 2FA, and solve CAPTCHAs.
> 2. The agent only navigates to the token creation page, fills token name/scope checkboxes, and reads the newly created token to store in the OS credential store.
> 3. Never store or ask for account master passwords.

---

## 1. GitHub
- **Dashboard URL**: `https://github.com/settings/tokens`
- **Recommended method**: GitHub CLI (`gh auth login -s repo,delete_repo`)
- **Web Token URL**: `https://github.com/settings/tokens/new`
- **Token Type**: Personal Access Token (Classic)
- **Token Note**: `omni-scaffold-token`
- **Expiration**: 90 days (or no expiration for local development)
- **Scopes to Select**:
  - `repo` (Full control of private repositories: repo:status, repo_deployment, public_repo, repo:invite, security_events)
  - `delete_repo` (Delete repositories)
- **Action**: Click "Generate token" at the bottom of the page. Copy the `ghp_...` string immediately.

---

## 2. Supabase
- **Dashboard URL**: `https://app.supabase.com/account/tokens`
- **Navigation**: Click user avatar (bottom left) -> Account Settings -> Access Tokens
- **Action**:
  - Click "Generate new token"
  - Name: `omni-scaffold`
  - Click "Generate token"
  - Copy the token starting with `sbp_...` immediately.

---

## 3. Vercel
- **Dashboard URL**: `https://vercel.com/account/tokens`
- **Navigation**: Click user avatar (top right) -> Settings -> Tokens
- **Action**:
  - Token Name: `omni-scaffold`
  - Scope: `Full Account`
  - Expiration: Choose duration (e.g. 90 days or No Expiration)
  - Click "Create"
  - Copy the generated token string.

---

## 4. Neon
- **Dashboard URL**: `https://console.neon.tech/app/settings/api-keys`
- **Navigation**: Click settings cog / Profile -> Account Settings -> API Keys
- **Action**:
  - Click "Create new API key"
  - Key Name: `omni-scaffold`
  - Click "Create"
  - Copy the key starting with `neon_...`.

---

## 5. Cloudflare
- **Dashboard URL**: `https://dash.cloudflare.com/profile/api-tokens`
- **Navigation**: Profile -> API Tokens -> Create Token
- **Action**:
  - Use template "Create Custom Token" or select permissions:
    - `Account` - `Cloudflare Pages` - `Edit`
    - `Account` - `Account Settings` - `Read`
  - Account Resources: `Include All accounts`
  - Click "Continue to summary" -> "Create Token"
  - Copy the token value.

---

## 6. Render
- **Dashboard URL**: `https://dashboard.render.com/u/settings#api-keys`
- **Navigation**: Account Settings -> API Keys
- **Action**:
  - Click "Create API Key"
  - Label: `omni-scaffold`
  - Click "Create"
  - Copy the key value.

---

## 7. Resend (Email)
- **Dashboard URL**: `https://resend.com/api-keys`
- **Action**:
  - Click "Create API Key"
  - Name: `omni-scaffold`
  - Permission: `Full access`
  - Domain: `All domains`
  - Click "Add" and copy the `re_...` key.

---

## 8. Upstash (Redis)
- **Dashboard URL**: `https://console.upstash.com/account/api`
- **Action**:
  - Go to Account -> Management API
  - Copy or create an API Key.

---

## 9. Clerk (Auth)
- **Dashboard URL**: `https://dashboard.clerk.com`
- **Action**:
  - Open application -> API Keys
  - Copy `Publishable Key` (`pk_test_...`) and `Secret Key` (`sk_test_...`).
