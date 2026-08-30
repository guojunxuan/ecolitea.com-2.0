# Ecolitea 2.0 README Rewrite Design

## Goal

Replace the inherited Payload website-template README with a concise English guide for the
current Ecolitea 2.0 repository. A new contributor should be able to understand the system,
start it locally, run its checks, and find the production deployment runbook without reading
irrelevant upstream-template instructions.

## Audience

Developers and operators working directly on Ecolitea 2.0.

## Content to retain

- A short project overview and the current technology stack.
- Runtime prerequisites and dependency installation.
- The verified local startup command for the existing Docker MongoDB mapping on port `27018`.
- Website and Payload Admin URLs.
- Common development, test, type-check, build, and start commands sourced from `package.json`.
- A concise environment-variable overview, referring readers to `.env.example` for the full
  contract and avoiding secrets or production credentials.
- The CI behavior that disables R2 only during validation checks.
- The production path through Cloudflare, Caddy, the application container, MongoDB, R2, and
  GHCR.
- A link to `docs/deployment.md` for operational procedures.

## Content to remove

- Payload template marketing copy and upstream feature tutorials.
- `create-payload-app` cloning instructions.
- Postgres, Vercel Postgres, Vercel Blob, and one-click Vercel deployment guidance.
- Demo credentials and destructive template seed instructions.
- Generic Payload community-support links.
- Duplicate development and production sections.

## Proposed structure

1. Project overview
2. Technology stack
3. Local development
4. Common commands
5. Environment configuration
6. Testing and CI
7. Production architecture
8. Deployment documentation

## Constraints

- Keep the README between roughly 80 and 120 lines.
- Keep all prose in English.
- Do not duplicate the detailed deployment runbook.
- Do not include secrets, credentials, or environment values beyond safe local/test examples.
- Do not change application behavior or configuration as part of this documentation task.

## Verification

- Confirm every documented command exists in `package.json` or is the verified local startup
  command.
- Confirm referenced files and URLs exist.
- Run `git diff --check` and review the rendered Markdown structure.
- Scan the final README for obsolete references to Payload templates, Postgres, and Vercel.
