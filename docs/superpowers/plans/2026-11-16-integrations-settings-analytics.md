# Integrations Settings and Analytics Implementation Plan

> **For agentic workers:** Use subagent-driven-development for independent tasks and review each result before integration. Track completed steps below.

**Goal:** Manage Google integrations in Payload, protect credentials with admin roles and encryption, and emit consent-compatible business events.

**Architecture:** Users owns the minimal role model. Site Settings owns persisted integrations and a server-only normalized resolver; translation resolves credentials at operation time. The frontend receives only the public GTM ID, and typed client events remain local until GTM handles consent.

**Tech Stack:** Payload 4.0.0-canary.29, Next.js 16.3.3, React 19, MongoDB, TypeScript, Vitest, pnpm.

## 1. Roles, encrypted settings, and normalized runtime model (lead)

Files: `src/access/isAdmin.ts`, `src/collections/Users/index.ts`, `src/migrations/20261116_user_roles.ts`, `src/utilities/secretBox.ts`, `src/SiteSettings/integrations.ts`, `src/SiteSettings/fields/integrations.ts`, `src/SiteSettings/fields/index.ts`, `src/SiteSettings/config.ts`, `src/SiteSettings/components/GoogleTranslateKeyStatus.tsx`, `tests/int/integrations-settings.int.spec.ts`, `tests/int/integrations-access.int.spec.ts`.

- [ ] Read installed field/global/auth operation types and official beta field-access documentation. Field access silently discards denied values, so enforce forbidden writes in a global hook before fields are stripped.
- [ ] Write failing encryption/resolver tests: round trip, tampering, rotated secret, absent/invalid ID, positive safe-integer fallback, configured/missing/undecryptable status. Run `DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/integrations-settings.int.spec.ts`.
- [ ] Implement AES-256-GCM with a context-derived 256-bit key and random 12-byte IV; return `{ ok: false }` on invalid ciphertext. Resolver calls `findGlobal({ slug: 'site-settings', depth: 0, overrideAccess: true })` and never crosses a client boundary.
- [ ] Add native virtual password/text and clear checkbox inputs with admin field access; native encrypted/Last4 fields deny external writes. Hook rejects direct protected-field writes and non-admin key inputs, encrypts before storage, then deletes transient plaintext/clear inputs. Admin-only server UI reports status without passing plaintext to a client.
- [ ] Add role select (editor default, JWT), first-user promotion, and migration of all current users to admin. Use trusted migration context for internal role writes; do not alter collection access.
- [ ] Write/run isolated MongoDB tests for first user, all-users migration, role escalation rejection, admin key replace/clear, editor denial, public REST and authenticated responses omitting ciphertext, editor/public responses omitting Last4. Database/storage targets must be reported before fixtures/migration.
- [ ] Verify existing Site Settings invalidation covers layouts and cached settings; update focused schema tests.

## 2. Typed business events (independent agent)

Files: `src/consent/analytics.ts`, quote form, Page Form block, DownloadDialog, Footer ContactList and focused component specs.

- [ ] Add failing tests for exact event payloads, SSR/no-throw behavior, quote success versus failure, actual download/contact actions.
- [ ] Implement union-keyed event params: `quote_submit: { product_slug }`, `form_submit: { form_title }`, `file_download: { file_name, product_slug }`, `contact_click: { method: 'email' | 'phone' }`. Push only explicit allowed params; never include user form values or contact values.
- [ ] Run relevant component specs and report commands. Commit only owned files with `feat(analytics): track successful business actions`.

## 3. Translation runtime (independent agent)

Files: `src/plugins/translation/task.ts`, `dictionary.ts`, `admin/TranslationStatus.tsx`, `scripts/translation-backfill.ts` if needed, relevant translation/backfill/status specs.

- [ ] Write failing tests that settings changes after runtime construction affect queueing, execution and monthly limit; missing/undecryptable credentials skip without provider calls.
- [ ] Consume `getIntegrations(payload, req?)` at queue/run time; preserve injected provider/enabled test contracts and JOBS_AUTORUN. Read the normalized monthly limit for status and reservation. Search scripts for stale enablement decisions.
- [ ] Run only affected translation specs. Commit only owned files with `feat(translation): resolve integration settings at runtime`.

## 4. Environment and deployment documentation (independent agent)

Files: `src/utilities/env.ts`, `src/environment.d.ts`, `.env.example`, `Dockerfile`, `.github/workflows/release.yml`, env specs, `docs/deployment.md`, `docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md`.

- [ ] Search all application/scripts/tests/config/Compose references before removing obsolete Docker/workflow variables; keep used arguments and R2_PUBLIC_URL.
- [ ] Remove three superseded Google variables; expose literal Turnstile public env read and regroup example variables. Resolve GHCR_REPOSITORY against Compose.
- [ ] Replace deployment instructions with one environment table, runtime Integrations settings, event dictionary and GTM/GA4 setup and verification, roles/migration, secret rotation, translation worker topology. No GitHub Variables instructions.
- [ ] Update existing env tests, run them, and force-add ignored docs. Commit env and docs separately.

## 5. Frontend integration and final review (lead)

Files: `src/consent/gtm.ts`, `ConsentProvider.tsx`, `src/providers/index.tsx`, `src/app/(frontend)/[lang]/layout.tsx`, targeted consent/settings/e2e fixture specs, generated artifacts.

- [ ] Update failing consent tests to supply a GTM ID prop; retain shared `validGtmId`. Remove env-based lookup. Layout calls normalized resolver and passes only container ID/null, never translation settings.
- [ ] Regenerate using `DISABLE_R2_STORAGE=true corepack pnpm generate:types` and `DISABLE_R2_STORAGE=true corepack pnpm generate:importmap` with isolated test configuration if local credentials would otherwise be loaded.
- [ ] Run changed Vitest specs and existing relevant consent/settings/translation specs. No full e2e suite. Run `corepack pnpm exec tsc --noEmit --incremental false` and `corepack pnpm lint`.
- [ ] Request independent review; fix security or correctness findings, then rerun affected checks. Review `git diff --check`, stale-variable search and staged paths. Never stage the protected language-switcher files.
- [ ] Commit logical settings/frontend/test changes. Report commits, files by area, deviations/mismatches, exact verification results and outstanding limitations. Do not push or merge.
