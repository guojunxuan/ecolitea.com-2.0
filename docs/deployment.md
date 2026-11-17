# Production deployment

Copy `.env.example` to `.env` and configure the values in the [environment table](#environment-variables). Set `ECOLITEA_IMAGE` to the full image repository when overriding the Compose default, and select a release with `IMAGE_TAG`. Create an R2 bucket, S3 API token, and public custom domain; configure CORS for the site origin and media GET/HEAD.

Start the stack:

```sh
docker compose up -d mongodb ecolitea
docker compose ps
```

Upgrade or rollback by changing `IMAGE_TAG`, then:

```sh
docker compose pull ecolitea
docker compose up -d --no-deps ecolitea
```

Application releases never remove `mongodb_data` or recreate MongoDB. Back up with `mongodump --uri "$MONGODB_URI" --archive > backup.archive`; restore separately with `mongorestore --uri "$MONGODB_URI" --archive=backup.archive`.

Use Caddy with `deploy/Caddyfile.example` to proxy the public hostname to `127.0.0.1:3000`.

## Environment variables

`src/utilities/env.ts` owns the application server contract; `.env.example` groups the supported
configuration. Keep each environment's database, bucket and credentials isolated. Local development
reads the project `.env`. Compose reads its `.env` for substitutions and explicitly forwards server
values to the application. Recreate the application container after a runtime change; `docker compose
restart` alone does not apply changed Compose environment values. Public browser values are frozen
at image build time and require a rebuild. See [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables).

| Variable | Group | Required | Where set | Apply change |
|---|---|---|---|---|
| `DATABASE_URI` | Server runtime | Yes | Local `.env`; Compose maps `MONGODB_URI` to it | Restart local server / recreate application container |
| `PAYLOAD_SECRET` | Server runtime | Yes | Local `.env` / Compose `.env` | Restart / recreate; re-enter encrypted integration credentials after rotation |
| `NEXT_PUBLIC_SERVER_URL` | Server runtime / public origin | Yes | Local `.env` / Compose `.env`; match image build origin where inlined | Recreate server; rebuild if changing browser-inlined URLs |
| `CRON_SECRET` | Server runtime | Yes | Local `.env` / Compose `.env` | Restart / recreate |
| `PREVIEW_SECRET` | Server runtime | Yes | Local `.env` / Compose `.env` | Restart / recreate |
| `R2_BUCKET` | Server runtime | Yes in the server parser | Local `.env` / Compose `.env` | Restart / recreate |
| `R2_ACCESS_KEY_ID` | Server runtime | Yes in the server parser | Local `.env` / Compose `.env` | Restart / recreate |
| `R2_SECRET_ACCESS_KEY` | Server runtime | Yes in the server parser | Local `.env` / Compose `.env` | Restart / recreate |
| `R2_ENDPOINT` | Server runtime | Yes in the server parser | Local `.env` / Compose `.env` | Restart / recreate |
| `R2_PUBLIC_URL` | Server runtime / build | Yes | Local `.env`, Compose `.env`, Docker build argument | Recreate and rebuild: image host allowlist is build configuration |
| `TURNSTILE_SECRET_KEY` | Optional server feature | Required for quote submissions | Local `.env` / Compose `.env` | Restart / recreate |
| `QUOTE_IP_HASH_SALT` | Optional server feature | Required for quote submissions | Local `.env` / Compose `.env` | Restart / recreate |
| `REVALIDATE_SECRET` | Optional server feature | Required for background invalidation and scheduled publication | Local `.env` / Compose `.env` | Restart / recreate every worker and serving instance |
| `JOBS_AUTORUN` | Optional server feature | No; defaults to `false` | Local `.env` / Compose `.env`; `true` on exactly one long-running instance | Restart / recreate |
| `SMTP_HOST` | Optional server SMTP override | No; non-empty selects the entire env connection | Local `.env` / Compose `.env` | Restart / recreate every sending instance |
| `SMTP_PORT` | Optional server SMTP override | No; defaults to `587`, integer 1–65535 | Local `.env` / Compose `.env`; read only when `SMTP_HOST` is non-empty | Restart / recreate every sending instance |
| `SMTP_SECURE` | Optional server SMTP override | No; `none`, `starttls` (default), or `tls` | Local `.env` / Compose `.env`; read only when `SMTP_HOST` is non-empty | Restart / recreate every sending instance |
| `SMTP_USER` | Optional server SMTP override | Only if the SMTP service requires authentication | Local `.env` / Compose `.env`; read only when `SMTP_HOST` is non-empty | Restart / recreate every sending instance |
| `SMTP_PASSWORD` | Optional server SMTP override | Only if the SMTP service requires authentication | Local `.env` / Compose `.env`; server secret, read only when `SMTP_HOST` is non-empty | Restart / recreate every sending instance |
| `SMTP_FROM_ADDRESS` | Optional server SMTP override | Required for a configured env sender | Local `.env` / Compose `.env`; valid email, read only when `SMTP_HOST` is non-empty | Restart / recreate every sending instance |
| `SMTP_FROM_NAME` | Optional server SMTP override | No; optional sender display name | Local `.env` / Compose `.env`; read only when `SMTP_HOST` is non-empty | Restart / recreate every sending instance |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public build-time | Required to show the quote challenge | Local `.env` before build / Docker build argument | Rebuild and redeploy |
| `NEXT_PUBLIC_SITE_URL` | Retained compatibility build argument | Required by the current Dockerfile guard | Local build environment / Docker build argument | Rebuild; no application consumer |
| `NEXT_PUBLIC_CMS_URL` | Retained compatibility build argument | Required by the current Dockerfile guard | Local build environment / Docker build argument | Rebuild; no application consumer |
| `MONGODB_URI` | Deployment-only | Yes for Compose | Compose `.env`; use the `mongodb` service hostname and appropriate credentials | Recreate application container |
| `MONGO_INITDB_ROOT_USERNAME` | Deployment-only | Yes for a new Compose database | Compose `.env` | Initializes a new MongoDB volume only; existing users need a separate credential change |
| `MONGO_INITDB_ROOT_PASSWORD` | Deployment-only | Yes for a new Compose database | Compose `.env` | Initializes a new MongoDB volume only; existing users need a separate credential change |
| `ECOLITEA_IMAGE` | Deployment-only | No; defaults to `ghcr.io/ecolitea/ecolitea` | Compose `.env` | Pull and recreate application container |
| `IMAGE_TAG` | Deployment-only | No; defaults to `latest` | Compose `.env` | Pull and recreate application container |
| `DISABLE_R2_STORAGE` | Development & test | Set `true` for tests outside storage integration | Local/test process environment | Restart test process; R2 placeholders remain required by parser |
| `NEXT_DEV_ALLOWED_ORIGINS` | Development & test | No | Local `.env`; comma-separated hostnames | Restart dev server |
| `VERCEL_PROJECT_PRODUCTION_URL` | Platform-provided | No outside that platform | Hosting platform | Rebuild for build-time URL consumers; restart for runtime reads |
| `PRODUCT_DETAIL_SPECS_APPROVED_FINGERPRINT` | One-off repair | Only for the matching repair | Explicit script/migration process environment | Next invocation |
| `PRODUCT_OPTION_IMAGE_APPROVED_FINGERPRINT` | One-off repair | Only for the matching repair | Explicit script/migration process environment | Next invocation |
| `PRODUCT_OPTION_IMAGE_DEMO_REPAIR` | One-off repair | No; opt-in demo repair | Explicit script/migration process environment | Next invocation |
| `PRODUCT_OPTION_IMAGE_BACKUP_PATH` | One-off repair | Optional backup path for its report script | Explicit script process environment | Next invocation |

Some older public flags and URL/preview aliases remain forwarded by Compose/CI for compatibility.
They do not configure Google integrations. Treat the table and actual application consumers as the
supported contract. Do not put secrets in Docker build arguments or public variables.

## Migration checks

Check `corepack pnpm payload migrate:status` against the intended database before deploying.
`20261023_products_model_redesign` and `20261024_product_blocks_revision` are no-ops on
products and versions already in the current grouped-specification/section-block shape produced
by the later product migrations. Legacy transformations and full-scan blocking of unknown or
conflicting data still apply. Their historical local-target restrictions remain in force.
Their `down` operations refuse later product/section schemas rather than rewriting current data;
use the matching database backup and application revision when rolling back those later changes.

## Administrator roles and integration credentials

Users has `admin` and `editor` roles. The first account on a fresh database becomes `admin`; later
accounts default to `editor`. Before using the new controls on an existing installation, review and
apply `src/migrations/20261116_user_roles.ts` through the application's migration workflow against
the intended environment. It grants `admin` to **all existing users**, preserving access. Review the
exact database/storage target and take the normal database backup before running the migration.
Existing sessions may need a new login to receive the role in their token. Only an admin can change
roles or replace/clear the Google Translate API key and SMTP password. Collection and Global content access otherwise
keeps its existing authenticated-user rules.

The integration credentials are encrypted with AES-256-GCM using a key derived from `PAYLOAD_SECRET`.
The Admin shows each credential's status and last four characters; neither the encrypted fields
nor plaintext are exposed by public APIs, and editors cannot read the last four characters.
Replace or clear credentials with the dedicated inputs in **Site Settings → Integrations**. Leave
the replacement input empty to keep the current value. Do not select clear while entering a replacement.

Keep `PAYLOAD_SECRET` stable and shared by the serving and worker instances. Rotating it requires
re-entering the translation key and any stored SMTP password: existing ciphertext becomes **Needs re-entry (cannot decrypt)**.
Translation queueing/execution then skips cleanly; the public website continues rendering. A secret
rotation also affects authentication tokens. An SMTP environment password is independent of this
encryption key; it can provide the temporary recovery path below.

## Email delivery

The Payload email adapter in `src/plugins/email/` owns outbound SMTP delivery for quote
notifications, form-builder emails and forgot-password messages. Configure the connection in
**Site Settings → Integrations → Email**: host, port, security, username, sender address/name and
the write-only SMTP password input. Saving takes effect on the next send without a restart. The
source/status display distinguishes Environment variables, Site Settings, Not configured and
Needs re-entry. Stored connection values remain available when an environment override is active.

When `SMTP_HOST` is non-empty after trimming, **all seven `SMTP_*` variables form the effective
connection**. There is no field-by-field fallback to settings: supply the sender address and any
required credentials in the same source. An empty `SMTP_HOST` selects Site Settings and ignores
the other SMTP variables. SMTP is resolved on each send; a malformed override marks the
configuration invalid instead of preventing application startup or falling back to a different
source. Changing deployment variables requires restarting the local process or recreating each
sending application container; no image rebuild is needed. The legacy `SENDGRID_API_KEY` and
`EMAIL_FROM_*` variables do not configure this adapter.

Security is explicit: `starttls` requires a STARTTLS upgrade, `tls` uses TLS from connection
establishment, and `none` disables TLS for local capture servers. The default port is always `587`;
select the port required by the SMTP service when using another security mode. In production, use
a verified sender domain and publish your SMTP provider's SPF and DKIM records. Follow the
provider's instructions and the upstream [SPF](https://www.rfc-editor.org/info/rfc7208/) and
[DKIM](https://www.rfc-editor.org/info/rfc6376/) references; the application does not provision DNS
or sign messages itself.

Quote notifications default to enabled. **Quote notification recipients** accepts email rows;
an empty list falls back to the configured `salesEmail`. The visitor's address becomes Reply-To,
while the effective SMTP sender remains From. Configure form-builder notifications on each Form;
they use the same Payload adapter. Keep `NEXT_PUBLIC_SERVER_URL` at the canonical public origin
for Admin and password-reset links. **Send test email** is admin-only and sends to the signed-in
administrator's email, with one attempt per 30 seconds per administrator per application worker.
This in-memory limit is not shared across workers and resets on restart. The test uses the active
source, including any environment override.

### Local Mailpit capture

Mailpit runs from the project-owned `docker-compose.dev.yml` (image pinned on GHCR; never deploy
this file). Start it with `corepack pnpm mail:up` and stop it with `corepack pnpm mail:down`. It
listens only on `127.0.0.1`. Use this local `.env` group:

```dotenv
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=none
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM_ADDRESS=noreply@localhost
SMTP_FROM_NAME=Ecolitea local
```

Restart the local application, send an Admin test email, and inspect it at
`http://localhost:8025`. This example assumes the application and Mailpit run on the same host;
inside a container, use a Mailpit hostname reachable from that container. Mailpit captures mail
locally. Automated tests use injected transports and never connect to SMTP services.

### Recovery and delivery limits

If a broken Admin SMTP connection or undecryptable password prevents receiving password resets,
set a complete working `SMTP_*` environment group, including a non-empty `SMTP_HOST` and sender
address. Restart the local application, or run `docker compose up -d --no-deps ecolitea` to
recreate the application with the changed Compose values. Request a new password-reset email,
then sign in and repair the saved settings, re-entering the SMTP password after `PAYLOAD_SECRET`
rotation. Clear `SMTP_HOST` and restart/recreate again when returning control to Site Settings.

Missing, invalid or undecryptable configurations skip delivery and log a warning per attempt.
Transport errors and the roughly 10-second send timeout do not roll back saved quote requests or
form submissions, so the visitor can still see success when a notification was not delivered.
Forgot-password remains Payload's built-in flow: a reset cannot arrive without working email.
Failure logs contain recipient domain/count, subject and a sanitized error reason, never message
bodies or credentials. Delivery is best-effort: there is no durable email queue, retry worker or
email-history collection. A successful SMTP response does not prove inbox delivery; check the
provider's delivery/bounce tools when diagnosing missing mail.

## Cookie consent and Google Tag Manager

Payload owns the persisted configuration in **Site Settings → Legal & Privacy → Policy Pages**: select a published English
Page for **Cookie Policy Page** to show its link in the banner and Footer. Privacy Policy, Cookie
Policy, and Terms appear in that order when configured. Policy content should describe the services
actually enabled in the GTM container; keep that list current when adding services.

Set **GTM Container ID** in **Site Settings → Integrations → Google Tag Manager**. It is public
and optional: an empty value disables loading. The server trims it and accepts only `GTM-` followed
by uppercase letters or digits. Put the GA4 measurement ID (`G-…`) only in the GTM container's Google
tag configuration. The application installs GTM and delegates GA4 delivery to that container.
Changing the container ID requires saving settings and refreshing the page; no image rebuild is
needed. See [Site Settings operations](#site-settings-operations) for invalidation behavior.

The client consent provider reads `ec_consent` after hydration and applies the browser's Global
Privacy Control signal, which forces marketing off. It queues Consent Mode v2 defaults with
`analytics_storage`, `ad_storage`, `ad_user_data`, and `ad_personalization` denied before any GTM
bootstrap. It loads GTM only after at least one optional category is accepted. Undecided visitors
and visitors rejecting both categories do not load the container. Decisions expire after 180 days.

Configure the container before enabling it:

- Keep the built-in consent checks on GA4 and advertising tags. Analytics maps to
  `analytics_storage`; marketing maps to all three advertising consent types above.
- Require the corresponding category to be granted before a tag fires, including third-party and
  Custom HTML tags. Loading GTM for marketing alone must not start analytics tags, and vice versa.
  Built-in Google checks can adjust a tag's behavior while denied; they do not by themselves block
  all requests. Use the container's additional consent requirements to preserve Basic mode for
  each category.
- Let the application own consent initialization and updates. Do not add another consent default
  tag, CMP, direct GA4 script, or unconditional GTM embed in the website or container.
- Configure client navigation page views with a GTM **History Change** trigger, or GA4 enhanced
  measurement for browser history changes. Choose one route-change mechanism so navigation does
  not generate duplicate page views. The application neither reloads GTM nor pushes `page_view`
  events on client navigation.
- Do not send email addresses, phone numbers, quote messages, or other personal information to
  the data layer or tags. Restrict third-party tags to their consent category.

See Google's [consent mode overview](https://developers.google.com/tag-platform/security/concepts/consent-mode)
and [consent setup guide](https://developers.google.com/tag-platform/security/guides/consent) for
container configuration and consent-aware tag behavior.

The emergency switch is **Payload Admin → Site Settings → Integrations → Disable Google Tag Manager**.
It defaults to off. Enable and save it to prevent GTM loading regardless of visitor consent once
the Site Settings cache refreshes. Saving expires the Site Settings cache and invalidates language layouts for subsequent requests. An already running
container cannot be unloaded from an open page. Visitor withdrawal updates Consent Mode immediately;
withdrawing both optional categories also removes accessible `_ga`, `_ga_*`, and `_gcl_*` cookies
for the current host and parent domains. A full page reload is required to start without the
previously loaded script. Failed script loading does not interrupt browsing or cookie settings.

### Business event dictionary and GA4 setup

The website pushes only the following business fields to `window.dataLayer`. Submission events fire
after a successful response; download and contact events fire on the actual link action. No form
values, contact addresses, phone numbers, company names or quote text are included. Events can queue
locally before GTM loads; GTM consent requirements control external delivery.

| Event | Trigger | Parameters |
|---|---|---|
| `quote_submit` | Successful quote request | `product_slug` |
| `form_submit` | Successful Page form submission | `form_title` |
| `file_download` | Product download link clicked | `file_name`, `product_slug` |
| `contact_click` | Footer email or phone link clicked | `method`: `email` or `phone` |

1. Configure a Google tag in GTM with the intended GA4 `G-…` measurement ID, retaining the consent
   requirements above.
2. Create Version 2 **Data Layer Variables** for `product_slug`, `form_title`, `file_name` and
   `method`, matching these keys exactly. See Google's [data layer reference](https://developers.google.com/tag-platform/tag-manager/datalayer).
3. Create a **Custom Event** trigger for each event name in the table. Create one **Google Analytics:
   GA4 Event** tag per event, set its event name exactly, map only that event's listed parameters to
   the corresponding variables, and attach its trigger. Require `analytics_storage` consent on
   these analytics tags. See Google's [event setup guide](https://support.google.com/tagmanager/answer/13034206).
4. Decide which events represent conversions, then [mark those as key events in GA4](https://support.google.com/analytics/answer/13128484).
   Add custom dimensions for business parameters only when reports need them. If GA4 enhanced
   measurement already emits form/download events, adjust it so these custom events do not produce
   duplicate conversion counts.
5. Use **GTM Preview / Tag Assistant** on a test environment. Verify that no GTM script loads before
   optional consent or after rejecting both categories, and that analytics tags stay blocked for
   marketing-only consent. Accept analytics, perform each action and inspect the event, variables,
   consent state and fired GA4 tag. Confirm failed submissions emit no success event and inspect
   all parameters for personal data.
6. Verify received names and parameters in **GA4 Realtime** and, while debugging, [DebugView](https://support.google.com/analytics/answer/7201382).
   Repeat with the emergency disable switch and a fresh page. Publish the container only after
   this configuration has been reviewed in the intended environment.

The Footer's **Cookie settings** button lets visitors review or withdraw consent. Closing the
banner or the settings dialog does not save a decision. If an `ec_preferences` cookie exists, its
region/language preference can be cleared in the Necessary section. The frontend language
selector writes this preference without changing consent.

Browser tests use `GTM-TEST000` and fulfill `googletagmanager.com` requests locally. Run only the
consent spec with storage disabled when checking this feature:

```sh
DISABLE_R2_STORAGE=true corepack pnpm test:e2e tests/e2e/cookie-consent.e2e.spec.ts
```

Playwright selects a run-scoped local test database and cleans up its own fixtures. The automated
checks verify consent and script requests with an empty intercepted script; they do not validate
or publish a live GTM container.

## Translation backend (Phase 2)

Payload owns the translation lifecycle. The plugin at `src/plugins/translation` registers
`translations`, the private `translation-search` index, the `translation-usage` Global, source
hooks, and Jobs tasks. English documents and upload metadata keep their existing shapes.
Next.js supplies the authenticated cache-invalidation boundary; Google is a replaceable provider.
The frontend consumes ready translations through its language-aware reading boundary; the
translation plugin owns records, queueing and invalidation, while Next.js owns public routing and SEO.

The fixed language catalog is `src/i18n/catalog.ts`. Configure target status and visitor regions in
Site Settings → Language. English is the fixed source; `translating` and `live` are translation
targets. An empty configuration keeps only English and Global and queues no translation work.

An admin sets **Replace Google Translate API key** in **Site Settings → Integrations → Google
Translate**, then saves. The key enables the Google Cloud Translation Basic v2 adapter. A missing
or undecryptable key prevents new queueing and makes already queued tasks skip without contacting
Google. Settings are resolved at queue/run time, so replacing or clearing a key does not require an
image rebuild or worker restart. The Admin reports **Configured ••••1234**, **Not configured** or
**Needs re-entry (cannot decrypt)**; see the [role and credential section](#administrator-roles-and-integration-credentials).

**Translation Monthly Char Limit** in the same group defaults to `450000` and must be a positive
safe integer. The independent usage Global reserves deduplicated characters before sending a
document, including its HTML markers. Failed or partially sent attempts can count conservatively;
reservations are not refunded. The counter resets on the first reservation in a new UTC calendar
month, not when source content is deleted. This is an application budget, not a measurement of the
entire Google project's bill.

Configure worker and background invalidation values using the [environment table](#environment-variables).
Enable **exactly one** long-running instance with `JOBS_AUTORUN=true`; leave it false elsewhere.
Node instrumentation initializes `getPayload({ config, cron: true })`. The worker polls every
five seconds with `allQueues: true, limit: 1`, including Payload's native `schedulePublish` queue.
Quota reservation serialization is local to that Payload process, not a distributed quota lock.
Do not overlap external/manual runners with the automatic worker, and use `limit: 1` for every
manual Local API run. The retained `CRON_SECRET` endpoint can be used by an external scheduler:

```sh
curl --fail --header "Authorization: Bearer $CRON_SECRET" \
  "$NEXT_PUBLIC_SERVER_URL/api/payload-jobs/run?allQueues=true&limit=1"
```

That installed Payload endpoint uses **GET** and also handles scheduled tasks. See the official
[Payload Jobs documentation](https://payloadcms.com/docs/beta/jobs-queue/overview) for its public
Local API. The daily `resumeTranslationQuota` task requeues requests waiting since before the
current UTC month, prioritizing updates with an existing ready translation, then new publication
requests, then dictionary bootstrap requests. Run the container on UTC for midnight scheduling.
Google quota errors also wait conservatively for the next month.

### Google project configuration

Use an environment-specific Google Cloud project and API key, enable Cloud Translation Basic,
and complete the required billing setup. Restrict the key to the Translation API and applicable
server restrictions; keep it server-only. Follow Google's
[Basic REST reference](https://cloud.google.com/translate/docs/reference/rest/v2/translate) and
[current pricing](https://cloud.google.com/translate/pricing) rather than assuming a permanent
free-tier allowance.

In Google Cloud Console, open **APIs & Services → Cloud Translation API → Quotas** and lower the
daily character quota to fit the intended budget, accounting for other applications using the
same project. The application monthly guard and Google's daily quota are separate controls;
Google's daily quota resets on Pacific time. See
[Google's quota configuration](https://cloud.google.com/translate/quotas).

Under **Billing → Budgets & alerts**, create an alerts budget scoped to this project/service,
set appropriate actual and forecast thresholds, and route notifications to the responsible
operators. Alerts-only budgets notify; they do not themselves stop API calls. Follow Google's
[budget and alert guide](https://cloud.google.com/billing/docs/how-to/budgets).

### Cache delivery and operations

Set a strong, shared `REVALIDATE_SECRET` on every serving instance. It is required for background
cache invalidation, including native scheduled publication even when translation is disabled.
`NEXT_PUBLIC_SERVER_URL` must be reachable from the worker and route to the same site's Next
server. Ensure the reverse proxy forwards **POST `/next/revalidate`** and its Authorization
header. Do not expose this secret in a public environment variable.

The endpoint accepts `Authorization: Bearer <secret>` and JSON `{ "tags": [], "paths": [] }`.
Each request accepts at most 100 total entries; the client batches larger sets. Tags expire
immediately. Missing configuration returns 503, invalid authentication 401, and invalid input
400. Hooks retain their direct Next cache behavior inside a request; only the installed missing
work-store invariant causes HTTP fallback. Public English URLs remain unchanged; path invalidation
targets their internal `/en/...` routes and each live language route.

Translation Jobs retry twice, for three executions total. A durable translation checkpoint
prevents search/cache notification retries from spending translation quota again. Terminal
failure sets `failed` and `error` while retaining `fields` and `lastReadySourceVersion`.
Republishing the current English source requeues its work. Dictionary bootstrap only queues a
new content hash: unchanged failed dictionaries need explicit requeueing through the Jobs Local
API after the underlying problem is fixed. Incompatible dictionary interpolation placeholders
are rejected; reads return no translation if an older template no longer matches.

Unpublish and delete hooks remove all stored locales, including locales removed from config,
then request cache invalidation. These source-hook notifications are synchronous, not a durable
outbox: if delivery fails after deletion, fix the endpoint and explicitly resend the source's
`translation:<collection>:<id>:<locale>` tags plus `translations:<locale>`, `translation-search`
and `translations-sitemap`. Source visibility must also be checked by Phase 3 readers.

### Content and status ownership

Open **Payload Admin → System → Translations** for the read-only request list, per-language
tracked-request readiness, and current-month reserved characters. **System → Translation Usage**
contains the read-only counter. Staff access to translation requests and usage reuses the existing authenticated-user boundary;
the new role checks protect role changes and integration credentials. External translation/search writes
are denied; server Local API writes own these records.

Use the bulk producer described below after adding a target language. The readiness denominator
is tracked requests, not an inventory of all eligible site content; compare the dry-run inventory
before changing a language to `live`. Republishing English sources also requeues their translations.

Explicit rules cover Products, categories, Blogs, Posts, Case Studies, Pages, Forms, Header,
Footer, visitor-facing Settings, and Media `alt`/`caption`. Media has no drafts, so each save is
publication; filenames, URLs, dimensions and storage metadata stay shared. Pages referenced by
Site Settings' Privacy Policy, Cookie Policy or Terms fields are excluded, and changing those
references removes prior plugin-owned translations. Sources without a public document URL,
such as Media, Forms, Globals and the frontend dictionary, do not receive fabricated search rows.

The source dictionary is `src/i18n/dictionaries/en.json`. The frontend reads dictionary translations
server-side and passes the selected copy to client components. `mergeTranslation` returns English by reference, merges the latest compatible ready
checkpoint for configured target locales, and returns `null` when no usable translation exists.
Frontend callers also enforce public locale/source visibility, handle the English redirect
fallback, and partition caches by locale.

## Launching a frontend language (Phase 4)

Site Settings → Language owns target status and regions; `src/i18n/catalog.ts` owns the 18 supported
languages and provider codes. Add a target as `translating`, add its region entries and retain an
English region (empty regions use Global). Saving takes effect without deploying. A translating
locale remains unavailable to final public requests, the selector and SEO output. Enabling a
language does not enqueue a full backfill; explicitly inspect and execute the producer below.

Use the bulk producer to inspect and enqueue the current public inventory. Replace `<locale>`
with the configured code and explicitly select the environment's `DATABASE_URI` before running:

```sh
corepack pnpm exec tsx scripts/translation-backfill.ts --locale=<locale> --dry-run --confirm
corepack pnpm exec tsx scripts/translation-backfill.ts --locale=<locale> --confirm
```

Both commands print the target database host/name, locale, storage mode and execution mode before
initializing Payload. Non-test databases additionally require
`--confirm-non-test=<database-name>`; review the printed target before supplying it. The developer database named `ecolitea2` is refused. During
development and automated checks use only isolated local test databases, `DISABLE_R2_STORAGE=true`
and an injected stub provider; never enqueue against production or call Google from tests.

`--dry-run` reports counts per source, total documents and estimated deduplicated characters,
including dictionary text and rich-text HTML markers, without creating translation requests or
Jobs. The producer does not start a worker. Execute mode requires configured translation targets
and an enabled provider; it only saves plugin-owned translation requests and Jobs, never English
sources. Drafts, future/unset publication dates for Blogs/Products and the three legal Pages are
excluded. Non-draft sources (including Media and Forms), persisted Globals and the frontend
dictionary are included. Character estimates use the same extraction rules as the worker; current
quota usage, concurrent edits, reusable checkpoints and provider retries can change actual usage.

Jobs use Payload's public metadata and processing-order configuration: updates with a ready
checkpoint first, new publications second, first backfill/dictionary work third, FIFO within each
tier. The request stores its tier so next-month quota recovery preserves it. Existing Jobs without
the new metadata remain runnable and retain precedence. A backfill of the same version does not
demote a pending publication. Keep one worker with `limit: 1`; backfill does not run jobs itself.

Wait for **Payload Admin → System → Translations** to finish the inventory and check failures or
`waiting_quota` requests. Its completion denominator is tracked requests, so compare the dry-run
inventory as well. Before making a language public, run the read-only reserved-slug scan with an
explicit environment and its confirmation flags:

```sh
corepack pnpm exec tsx scripts/scan-reserved-slugs.ts --confirm
```

Resolve any reported conflicts manually; the scan never renames content. Change the target locale
to `live` in Site Settings and save. Only ready documents enter that language's public URLs and SEO
output. Keep the preview endpoints unprefixed, and verify that the reverse proxy preserves the
same host during English internal rewrites. The default configuration still contains only English.

### Site Settings operations

Brand, Contact & Social, Legal & Privacy, Integrations and Language use unnamed presentation
groups. Integrations owns the GTM container ID, emergency disable switch, monthly translation
budget, SMTP connection, quote notification controls and admin-only credential inputs. Existing Google environment settings must be entered in
Integrations after upgrading; they are not imported automatically. Legal & Privacy →
Cookie Consent controls the banner title and long explanations; empty values fall back to the
frontend dictionary. Translated Site Settings supply these explanations on non-English pages.

Language displays current UTC-month usage, the next reset, completion against the same public
source inventory as backfill, and native filtered links for failures and quota waits. Edit status
in the language table; its native controls bind to the Languages rows. Translations and Translation Usage are hidden from navigation
and linked here; their access controls are unchanged. Switching a language off retains stored
translations. Remove or reassign its region rows before saving; keep an English region.

Saving invalidates Site Settings, all language layouts and translated sitemaps. Built-in language
segments pass through Proxy; the layout enforces public status, including languages enabled
after a build. Language and Cookie panels use native dialogs with shared exclusivity.
See `superpowers/plans/2026-11-16-phase4-settings-language-and-panels.md` for the approved design.
