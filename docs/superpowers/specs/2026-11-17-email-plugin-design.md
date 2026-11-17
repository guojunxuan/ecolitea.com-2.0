# Email Plugin (SMTP, Integrations-managed with env override) — Design

- Date: 2026-11-17
- Branch: `feature/i18n-consent`
- Status: Approved
- Related: `docs/superpowers/specs/2026-11-16-integrations-settings-analytics-design.md`, `docs/deployment.md`

## Goal

Add outbound email to the Payload application as a project plugin, managed in **Site Settings → Integrations**, with an environment-variable override for reliability and local development.

In scope: quote request notifications, form-builder submission emails, Payload forgot-password emails.
Out of scope: email log collection (future, same plugin), customer confirmation emails, template editor.

## 1. Plugin structure — `src/plugins/email/`

- A custom adapter implementing Payload's public `EmailAdapter` type (`({ payload }) => ({ name, defaultFromAddress, defaultFromName, sendEmail })`), wired into `payload.config.ts` `email`.
  - No SMTP configuration is read at init.
  - On each `sendEmail`, resolve the effective configuration (section 2), then send with **nodemailer**.
  - Cache the nodemailer transport keyed by a hash of the effective connection config; a changed config produces a new transport on the next send. No restart needed.
- Dependency: add `nodemailer` (and `@types/nodemailer` if needed) directly. Do not use `@payloadcms/email-nodemailer` (it fixes transport options at init). Lockfile change is intentional.
- `defaultFromAddress` / `defaultFromName` returned at init are placeholders; the effective from values are applied per send from the resolved config.

## 2. Configuration source and precedence

- If `SMTP_HOST` is set (non-empty), the **entire connection** comes from env: `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` (`none` | `starttls` | `tls`), `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_ADDRESS`, `SMTP_FROM_NAME`.
- Otherwise, the connection comes from Site Settings → Integrations → Email.
- No per-field mixing between sources.
- `src/utilities/env.ts` parses the optional SMTP group (port integer 1–65535, secure enum, from address valid email when present). `src/environment.d.ts` and `.env.example` updated.
- Resolver returns a normalized model, e.g.:
  ```ts
  { source: 'env' | 'settings' | 'none'; status: 'configured' | 'missing' | 'undecryptable' | 'invalid';
    connection?: { host; port; secure; user?; password? }; from?: { address; name? } }
  ```

## 3. Site Settings → Integrations → Email

- Fields: host, port, security (none / STARTTLS / TLS), username, from address, from name.
- SMTP password: encrypted at rest with the existing `secretBox` (AES-256-GCM, key from `PAYLOAD_SECRET`), write-only admin input with replace/clear, `Last4` readable by admin only, encrypted field never readable through any API. Server-side rejection of non-admin writes.
- Extract the encrypted secret field pattern (fields + hooks + status UI) into a shared helper now that two consumers exist (Google Translate key, SMTP password). Keep the Google Translate behavior and tests unchanged.
- Source indicator (admin UI): "Environment variables" (fields shown read-only/disabled with a note) / "Site Settings" / "Not configured" / "Needs re-entry".
- Notifications group: `quoteNotificationsEnabled` (checkbox, default true), `quoteNotificationRecipients` (array of emails, optional; empty falls back to `salesEmail`).
- Send test email: admin-only custom endpoint (e.g. `POST /api/site-settings/email-test` or a plugin endpoint), sends to the requesting admin's email, rate-limited (e.g. 1 per 30 s per user), returns success or the transport error message (no secrets). Admin button component triggers it. Server access check is authoritative.
- Exclude all new fields from translation rules (`src/plugins/translation/rules/siteSettings.ts`), consistent with existing Integrations fields.

## 4. Emails

| Email | Implementation |
|---|---|
| Quote notification | After a quote request is successfully created (prefer `afterChange` on `quote-requests`, `operation === 'create'`, or the submit endpoint after create). Recipients from settings, fallback `salesEmail`. Disabled when the toggle is off. Subject like `New quote request: <product> — <company>`. Text + simple HTML body: product title/slug, name, email, company, message, Admin link (`NEXT_PUBLIC_SERVER_URL` + admin path). **Reply-To = customer email.** All user input HTML-escaped; header injection safe (strip CR/LF in subject parts). |
| Form submission | form-builder's built-in per-form emails via `payload.sendEmail`. Verify the plugin's `emails` config is enabled and works through the adapter. No new feature work. |
| Forgot password | Payload built-in. Verify the reset link uses the correct server URL. |

## 5. Failure behavior

- Email failure never fails the business write: quote requests and form submissions still save and the visitor still sees success.
- Sending has a timeout (~10 s) so endpoints do not hang.
- Failures log recipient domain/count, subject, and error reason — never body or secrets.
- Unconfigured (`status !== 'configured'`): do not send; log a warning once per send attempt.
- Forgot-password with unconfigured email: Payload behavior surfaces normally; document the env recovery path.

## 6. Local testing

- Mailpit (`brew install mailpit` or Docker). `.env`: `SMTP_HOST=127.0.0.1`, `SMTP_PORT=1025`, `SMTP_SECURE=none`, `SMTP_FROM_ADDRESS=noreply@localhost`. View at `http://localhost:8025`.

## 7. Testing (targeted only)

- Resolver: env overrides settings; settings only; none; undecryptable password; invalid env.
- Adapter: transport cache reused for same config, replaced on change; unconfigured → no throw.
- Access: editor cannot read Last4 or write the SMTP password; public REST read of `site-settings` exposes neither encrypted field nor Last4; test-email endpoint admin-only and rate-limited.
- Quote notification: content, escaping, Reply-To, fallback to `salesEmail`, toggle off, transport failure does not fail the quote request.
- form-builder email sends through the adapter.
- Use nodemailer `jsonTransport`/`streamTransport` or an injected transport in tests; never connect to a real SMTP server. Isolated MongoDB (`mongodb://127.0.0.1:27017/ecolitea2-test`), `DISABLE_R2_STORAGE=true`.
- Regenerate `payload-types.ts` and import map; `tsc --noEmit --incremental false`; lint.

## 8. Documentation

- `.env.example`: SMTP group with comments (optional; overrides Integrations when `SMTP_HOST` is set).
- `docs/deployment.md`: email configuration and precedence, Mailpit local testing, **recovery when Admin email settings are broken** (set `SMTP_*` env, restart), production SPF/DKIM reminder, env table rows.

## Constraints

- Follow AGENTS.md. Public Payload APIs only. Preserve unrelated user work; stage only touched files.
- Never contact real SMTP servers or production services in tests or verification.
