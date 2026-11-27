# Integrations Settings, Analytics Events, and Environment Contract — Design

- Date: 2026-11-16
- Branch: `feature/i18n-consent` (implemented directly on this branch)
- Status: Implemented on branch (report: `docs/superpowers/reports/2026-11-16-integrations-settings-analytics.md`). Follow-ups: local E2E verification 2026-11-17; consent revocation sweep fix `3dab8cf` (2026-11-18)
- Related: `docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md`, `docs/deployment.md`

## Goal

1. Move Google integration configuration out of environment variables into **Site Settings → Integrations**, managed in the Admin UI.
2. Store the Google Translate API key encrypted, visible and editable only by `admin` users.
3. Emit a small set of business events to the GTM `dataLayer` so GA4 (configured in GTM, not in code) can measure conversions.
4. Clean up and document the environment-variable contract.

Non-goals: direct GA4 installation, GitHub Variables setup docs, a full RBAC system, funnel events (`quote_open` etc.), changes to `JOBS_AUTORUN` semantics.

## 1. Minimal user roles

- `Users` gains `role`: select `admin` | `editor`, required, `defaultValue: 'editor'`, `saveToJWT: true`.
- Field-level access: only `admin` may create/update `role` (prevents self-escalation). Reading is allowed to authenticated users.
- New helper `src/access/isAdmin.ts` (`({ req }) => req.user?.role === 'admin'`), plus a field-access variant if needed.
- Migration under `src/migrations/` sets `role: 'admin'` on **all existing users**. Nobody loses access.
- First-user creation: the first registered user must become `admin` (hook or `create-first-user` handling) so a fresh database is not locked out.
- No other collection/global access rules change in this work.

## 2. Site Settings → Integrations

The tab already exists (`src/SiteSettings/fields/index.ts`). Final contents:

### Google Tag Manager group
- `gtmContainerId`: text, optional. Server validation `^GTM-[A-Z0-9]+$` (trimmed; empty allowed = GTM disabled). Public-readable (the ID is public in page source anyway).
- `disableGtm`: existing switch, unchanged behavior.
- Remove `GtmContainerStatus` UI component (it displayed the env var).

### Google Translate group
- `translationMonthlyCharLimit`: number, required, default `450000`, positive safe integer. Replaces `TRANSLATION_MONTHLY_CHAR_LIMIT`. `TranslationStatus` reads it from settings instead of `serverEnv`.
- API key, admin-only:
  - `googleTranslateApiKeyEncrypted`: hidden field, field access `read: () => false`, `update: () => false` for every user. Only server code using the Local API with `overrideAccess` reads it. Never present in REST/GraphQL responses or frontend data.
  - `googleTranslateApiKeyLast4`: text, readOnly, field access read = admin only.
  - Write-only input: an admin-only virtual/input field (or custom Admin field component scoped to a project class) where the admin types a new key or chooses "clear". A `beforeChange` hook on the global encrypts a new value into `googleTranslateApiKeyEncrypted`, sets `Last4`, and never persists plaintext. Clearing removes both. Non-admin writes to these fields are rejected server-side.
  - Admin displays: "Configured ••••1234", "Not configured", or "Needs re-entry (cannot decrypt)".
  - Editors do not see the API key block (`admin.condition` / field access), but server rules are the real guard.
- `Site Settings` global `read: anyone` stays; protection relies on field-level access, covered by tests.

### Encryption
- New server-only module, e.g. `src/utilities/secretBox.ts`: AES-256-GCM via Node `crypto`, key derived from `PAYLOAD_SECRET` (HKDF or SHA-256 with a fixed context label), random 12-byte IV, stored as a versioned string `v1:<iv>:<tag>:<ciphertext>` (base64url).
- Decryption failure (tampering, rotated `PAYLOAD_SECRET`) returns a typed failure, never throws into page rendering. Translation reports status `undecryptable`; jobs do not run; site keeps working.
- Rotating `PAYLOAD_SECRET` requires re-entering the key. Documented.

## 3. Runtime resolution

- New server-only module `src/SiteSettings/integrations.ts`: `getIntegrations(payload)` → normalized model:
  ```ts
  {
    gtm: { containerId: string | null; disabled: boolean }
    translate: {
      apiKey: string | null
      status: 'configured' | 'missing' | 'undecryptable'
      monthlyCharLimit: number
    }
  }
  ```
  Consumers use this model, not raw fields.
- Frontend: `src/app/(frontend)/[lang]/layout.tsx` passes `gtmContainerId` (null when disabled or empty) through `Providers` to `ConsentProvider`. `gtm.ts` drops `getGtmId()` / env reading; `validGtmId` stays as the shared validator (used by field validation too). Existing `revalidateSiteSettings` refreshes cached pages after save — verify it covers this.
- Translation plugin: `src/plugins/translation/task.ts` and `dictionary.ts` stop deciding enablement at startup from `serverEnv.GOOGLE_TRANSLATE_API_KEY`. They resolve the key and limit at run/queue time via `getIntegrations`. Missing/undecryptable key → no queueing / task skips with a clear log, no crash.
- `JOBS_AUTORUN` remains an environment variable (per-instance deployment topology).

## 4. dataLayer events

- New client module `src/consent/analytics.ts`: `trackEvent(name, params)` → `window.dataLayer.push({ event: name, ...params })`.
  - Event names restricted by a TypeScript union with per-event param types.
  - No-op when `window` is undefined; never throws.
  - Does not check consent itself: GTM only loads after consent; Consent Mode governs sending. Pushing before GTM loads only queues locally.
- Events (fire only on success / actual action; **no PII** — never name, email, company, message, phone values):

| Event | Where | Params |
|---|---|---|
| `quote_submit` | `src/components/Products/QuoteRequest/QuoteRequestForm.tsx`, after successful submit response | `product_slug` |
| `form_submit` | `src/collections/Pages/blocks/Form/Component.tsx`, after successful form-submissions response | `form_title` |
| `file_download` | `src/components/Products/ProductActions/DownloadDialog.tsx`, on download link click | `file_name`, `product_slug` |
| `contact_click` | `src/Footer/ContactList.tsx`, on `mailto:` / `tel:` click | `method: 'email' \| 'phone'` |

## 5. Environment contract

Remove from `src/utilities/env.ts`, `src/environment.d.ts`, `.env.example`, `Dockerfile`, `.github/workflows/release.yml`, and docs:
- `NEXT_PUBLIC_GTM_MEASUREMENT_ID`, `GOOGLE_TRANSLATE_API_KEY`, `TRANSLATION_MONTHLY_CHAR_LIMIT`.

Remove unused variables from `Dockerfile` and `release.yml` after a repo-wide search (`src`, `scripts`, `tests`, `next.config.*`, `payload.config.ts`, compose files) confirms zero references: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `PAYLOAD_PUBLIC_APP_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `NEXT_PUBLIC_IS_LIVE`, `NEXT_PUBLIC_ENABLE_*`, `NEXT_PUBLIC_SKIP_BUILD_*`, `NEXT_PRIVATE_DRAFT_SECRET`, `NEXT_PRIVATE_REVALIDATION_KEY`, `REVALIDATION_KEY`. Keep `R2_PUBLIC_URL` build arg. Any variable found in use is kept and reported.

`src/utilities/env.ts`:
- Add a `publicEnv` section for `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (literal `process.env.NEXT_PUBLIC_…` access so Next inlines it).
- Keep test defaults working.

`.env.example`: regroup with comments — Required (server runtime) / Optional features (server runtime) / Public (build-time, rebuild required) / Deployment-only (Compose, image) / Development & test only (`DISABLE_R2_STORAGE`, `NEXT_DEV_ALLOWED_ORIGINS`) / Platform-provided (`VERCEL_PROJECT_PRODUCTION_URL`) / One-off data repair scripts (`PRODUCT_*` vars). Remove stale Postgres `DATABASE_URL` comment. Resolve `GHCR_REPOSITORY` (documented in `deployment.md` line 3 but absent from `.env.example`): add if used by deployment files, otherwise drop from docs.

No GitHub Variables documentation.

## 6. Documentation

- `docs/deployment.md`:
  - New "Environment variables" section with one table: variable, group, required, where set (local `.env`, Compose `.env`, Docker build arg), restart vs rebuild. Other sections link to it.
  - GTM section: container ID is set in Site Settings → Integrations; GA4 `G-…` only in GTM; remove `NEXT_PUBLIC_GA_MEASUREMENT_ID` mention; event dictionary; GTM setup steps (Data Layer Variables, Custom Event triggers, GA4 Event tags, mark key events in GA4); verification via GTM Preview and GA4 Realtime.
  - Translation section: key and monthly limit in Integrations (admin only); `PAYLOAD_SECRET` rotation requires re-entering the key; `JOBS_AUTORUN` unchanged.
  - Site Settings operations section updated.
  - Roles: existing users migrated to admin; only admins change roles and the translate key.
- `2026-11-15-i18n-region-consent-design.md`: update GTM variable references to point at Integrations.

## 7. Testing (targeted only; no global e2e)

- Unit: `secretBox` round-trip, tamper detection, wrong-secret failure.
- Unit: GTM ID validation; `getIntegrations` normalization (missing / configured / undecryptable).
- Unit/component: `trackEvent` payload shape and SSR safety; quote form pushes only on success, not on failure.
- Integration (MongoDB): editor cannot read `Last4` or write key/role; public REST read of `site-settings` contains neither encrypted field nor `Last4`; admin can set and clear key; migration sets existing users to admin.
- `env.ts` parsing tests updated.
- Regenerate `src/payload-types.ts` and import map (`corepack pnpm generate:types`, `generate:importmap`).
- `corepack pnpm exec tsc --noEmit --incremental false` and `corepack pnpm lint`.
- Existing targeted consent tests that referenced the env var are updated, not deleted.

## Constraints

- Do not touch the user's uncommitted work: `src/Header/Nav/LanguageSwitcher.tsx`, `src/Header/Nav/MobileNav.tsx`, `tests/int/language-switcher.int.spec.tsx`. Never stage them.
- Never contact production services; use `DISABLE_R2_STORAGE=true` where storage is out of scope.
- Follow AGENTS.md conventions (Payload public APIs, no private DOM, generated artifacts regenerated, not hand-edited).
