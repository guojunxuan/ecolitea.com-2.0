# Email Plugin Implementation Plan

> **For agentic workers:** Execute task-by-task with test-driven development and verification before completion. Independent owners may work in parallel; the lead reviews spec compliance and integration before committing.

**Goal:** Send quote, form-builder and password-reset email through runtime SMTP configuration with encrypted Admin settings and a complete environment override.

**Architecture:** Payload's public EmailAdapter owns delivery. A server resolver chooses the complete environment connection when SMTP_HOST is nonempty, otherwise Site Settings, without field mixing. Native fields and a shared encrypted-secret helper protect both SMTP and Google credentials. Delivery returns a safe sent/skipped/failed result so business writes survive failures; a dedicated admin endpoint exposes test delivery results.

**Tech Stack:** Installed Payload 4 canary, Next.js 16, MongoDB, TypeScript, nodemailer, pnpm, Vitest.

## Boundaries and ownership

- Lead: `src/fields/encryptedSecret.ts`, shared status component, `src/SiteSettings/fields/integrations.ts`, Email fields, SiteSettings hooks, `src/payload.config.ts`, dependency installation, generated artifacts, access tests, final review.
- Runtime: `src/plugins/email/config.ts`, `adapter.ts`, `endpoint.ts`, Admin source/test controls and focused tests. Export `getEmailConfiguration(payload, req?)`, `createEmailAdapter(options?)`, `createTestEmailEndpoint(options?)`; send result `{ status: 'sent' | 'skipped' | 'failed'; error?: string }`.
- Notifications: `src/plugins/email/quoteNotification.ts`, quote collection hook, quote/form/password targeted tests. Use Payload sendEmail, never direct SMTP.
- Environment/docs: `src/utilities/env.ts`, `src/environment.d.ts`, `.env.example`, translation exclusions, deployment docs and parser tests.

Persisted names: `smtpHost`, `smtpPort` (587), `smtpSecurity` (starttls), `smtpUser`, `smtpFromAddress`, `smtpFromName`, `smtpPasswordEncrypted`, `smtpPasswordLast4`, virtual `smtpPasswordInput` / `smtpPasswordClear`; `quoteNotificationsEnabled` (true), `quoteNotificationRecipients` rows with `email`.

## Task 1: Installed API review and dependency

- [x] Inspect installed EmailAdapter, endpoint, field/Global hook, form-builder email and forgot-password APIs. Read installed Next docs before changing any Next route or rendering behavior.
- [x] Add nodemailer using `corepack pnpm add nodemailer`; add types with `corepack pnpm add -D @types/nodemailer` if needed. Do not alter Payload versions.
- [x] Commit dependency change alone after checking package/lock diff.

## Task 2: Runtime resolver and delivery

- [x] Write failing tests for env-whole-connection precedence, settings/none/invalid/undecryptable states and live settings changes.
- [x] Implement a normalized server model; call a pure optional SMTP parser at send time. Default port 587/security starttls. Unauthenticated transport is allowed when username is empty; a stored undecryptable password is never silently ignored.
- [x] Write failing adapter tests using injected/json/stream transport only: no init reads, reused/replaced connection hash cache, dynamic from, skip, sanitized failures, and ~10-second deadline.
- [x] Implement per-send resolver, bounded transport timeout, sanitized logging of recipient domains/count, subject and reason; never log body/password. Return safe delivery results.
- [x] Test the authoritative admin-only per-user 30-second endpoint, response redaction and UI button behavior. Source indicator displays env/settings/none/re-entry states; environment inputs read-only.

## Task 3: Shared secret fields and Settings

- [x] Preserve and run existing Google credential tests before extraction.
- [x] Extract fields, server hooks and status display into a helper parameterized by field names/labels. Keep Google's exact names, trim/empty behavior, encryption format and API access unchanged.
- [x] Add native SMTP fields and password replace/clear using that helper; never expose encrypted fields, Last4 admin only; server rejection protects all API writes. Preserve inactive settings during env override.
- [x] Add notifications controls and source/test UI slots. Wire Global hooks, custom endpoint and EmailAdapter via public config.
- [x] Prove public/editor/admin secret access and replacement/clear behavior with focused tests; Mongo only at `127.0.0.1:27017/ecolitea2-test`.

## Task 4: Notifications and built-in consumers

- [x] Write failing quote notification tests: create-only after successful save; recipients/fallback/toggle; text/HTML product/customer/admin link; HTML escaping and CR/LF-safe subject; Reply-To customer; failure isolation.
- [x] Register an afterChange create hook; do not send on updates, never let lookup/transport errors fail quote persistence.
- [x] Inspect and exercise actual form-builder email hook through the adapter with a nonnetwork transport. Exercise Payload forgot-password with correct serverURL/reset URL. Confirm form submissions save on delivery failure.
- [x] No email history collection, template editor or customer confirmation feature.

## Task 5: Environment and operations documentation

- [x] Add pure `parseSmtpEnv` in env.ts, validating optional group at runtime: integer port 1–65535, security enum, valid from email. Resolver catches invalid configuration as status invalid; no startup SMTP dependency.
- [x] Document all seven SMTP variables, whole-source precedence, Mailpit 1025/8025, environment recovery/restart and SPF/DKIM. Exclude every email/notification field from translation rules.

## Task 6: Integration review, generation, verification and report

- [x] Review secrets, native Admin save serialization, timeout boundaries and logging; review real form/password call sites against installed code.
- [x] Run only relevant added/modified specs plus existing Google/Integrations/settings/translation exclusions specs. Never connect to real SMTP or production services. Set `DISABLE_R2_STORAGE=true`, `JOBS_AUTORUN=false`; DB tests explicitly target ecolitea2-test, never ecolitea2.
- [x] Run `corepack pnpm generate:types`, `corepack pnpm generate:importmap`; generated files are never manually edited.
- [x] Run `corepack pnpm exec tsc --noEmit --incremental false` and `corepack pnpm lint`.
- [x] If useful, verify Email Admin controls in an isolated throwaway database, then stop servers and drop only that database under a strict target guard. No full e2e run.
- [x] Commit logical areas using explicit paths, including ignored docs via `git add -f`; preserve concurrent consent edits. No branch creation/push/merge.
- [x] Save/report commit list, file areas, deviations/mismatches, exact verification commands/results, unverified boundaries and Mailpit instructions.
