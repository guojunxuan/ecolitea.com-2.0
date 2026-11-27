# Ecolitea 2.0 README Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inherited Payload template README with an English, project-focused guide for Ecolitea 2.0.

**Architecture:** Keep the detailed operational runbook in `docs/deployment.md` and make the root README the concise entry point for development and deployment. Document only commands and behavior that exist in the current repository.

**Tech Stack:** Markdown, Next.js 16, Payload CMS 4, MongoDB 7, Cloudflare R2, Docker Compose, Caddy, pnpm.

---

### Task 1: Rewrite and verify the root README

**Files:**
- Modify: `README.md`
- Reference: `package.json`
- Reference: `.env.example`
- Reference: `docs/deployment.md`

- [ ] **Step 1: Replace the inherited template content**

Write a concise English README with these exact sections and facts:

````markdown
# Ecolitea 2.0

Ecolitea 2.0 is a self-hosted website and content-management application. Next.js serves the
public website and Payload Admin from one application, MongoDB stores content, and Cloudflare
R2 stores uploaded media.

## Technology stack

- Next.js 16 and React 19
- Payload CMS 4
- TypeScript and Tailwind CSS
- MongoDB 7
- Cloudflare R2 media storage
- Docker Compose and Caddy for production
- pnpm 9.15.4

## Local development

### Requirements

- Node.js 24.20.0 or another release matching `package.json`
- Corepack with pnpm 9.15.4
- A running MongoDB instance

Install the locked dependencies and generate the Payload Admin import map:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm generate:importmap
```

The existing local Docker MongoDB is exposed on port `27018`. Start the development server with:

```bash
DATABASE_URI=mongodb://127.0.0.1:27018/ecolitea corepack pnpm dev
```

- Website: `http://localhost:3000`
- Payload Admin: `http://localhost:3000/admin`

Keep the terminal running while developing. Press `Ctrl+C` to stop the service.

## Common commands

```bash
corepack pnpm dev                 # Start the development server
corepack pnpm test:int            # Run integration tests
corepack pnpm test:e2e            # Run Playwright end-to-end tests
corepack pnpm exec tsc --noEmit   # Type-check the project
corepack pnpm lint                # Run ESLint
corepack pnpm build               # Create a production build
corepack pnpm start               # Start a completed production build
```

Integration and end-to-end tests require MongoDB. Playwright also requires its Chromium browser:

```bash
corepack pnpm exec playwright install chromium
```

## Environment configuration

Copy `.env.example` to `.env` and replace its placeholders. The main configuration groups are:

- Application: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`
- Payload operations: `CRON_SECRET`, `PREVIEW_SECRET`
- R2 storage: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`
- Public URLs and optional integrations: see `.env.example`

Never commit `.env`, database credentials, Payload secrets, or R2 access keys.

## Testing and CI

GitHub Actions starts a disposable MongoDB 7 service, installs locked dependencies, and runs
integration tests, Playwright tests, type checking, and the production build.

Validation jobs set `DISABLE_R2_STORAGE=true`, so test uploads use local temporary storage and
never contact production R2. Docker image builds and production runtime do not set this flag;
R2 remains enabled there.

The CI and release workflows are manually triggered with `workflow_dispatch`.

## Production architecture

```text
Visitor -> Cloudflare CDN/TLS -> Caddy -> Next.js + Payload
                                           |-> MongoDB
                                           `-> Cloudflare R2

GitHub Actions -> GHCR -> Docker Compose
```

Docker Compose runs the application, MongoDB, and Caddy. MongoDB data is stored in the
`mongodb_data` volume, while uploaded media remains in Cloudflare R2.

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for initial server setup, releases, upgrades,
rollbacks, backups, recovery, and health checks.
````

- [ ] **Step 2: Verify documented commands and references**

Run:

```bash
rg -n '"(dev|test:int|test:e2e|lint|build|start)"' package.json
test -f .env.example
test -f docs/deployment.md
```

Expected: every documented script appears in `package.json`, and both referenced files exist.

- [ ] **Step 3: Check for obsolete template content**

Run:

```bash
rg -n 'Payload Website Template|create-payload-app|Postgres|Vercel|Discord' README.md
```

Expected: no matches.

- [ ] **Step 4: Check Markdown diff quality**

Run:

```bash
git diff --check -- README.md
wc -l README.md
```

Expected: no whitespace errors and approximately 80–120 lines.

- [ ] **Step 5: Commit the README and plan**

```bash
git add README.md docs/superpowers/plans/2026-08-30-readme-rewrite.md
git commit -m "docs: replace template README"
```
