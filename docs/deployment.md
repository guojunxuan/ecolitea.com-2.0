# Production deployment

Copy `.env.example` to `.env` and set `GHCR_REPOSITORY`, `IMAGE_TAG`, `MONGODB_URI`, Payload secrets, and Cloudflare R2 credentials. Create an R2 bucket, S3 API token, and public custom domain; configure CORS for the site origin and media GET/HEAD.

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

## Cookie consent and Google Tag Manager

Payload owns the persisted configuration in **Site Settings → Legal**: select a published English
Page for **Cookie Policy Page** to show its link in the banner and Footer. Privacy Policy, Cookie
Policy, and Terms appear in that order when configured. Policy content should describe the services
actually enabled in the GTM container; keep that list current when adding services.

Set the optional public container ID in the build environment:

```dotenv
NEXT_PUBLIC_GTM_MEASUREMENT_ID=GTM-XXXX
```

Only uppercase container IDs matching `GTM-` followed by letters or digits are accepted. An empty or
invalid value disables loading. This variable is public and is separate from
`NEXT_PUBLIC_GA_MEASUREMENT_ID`; the application does not install GA4 directly.

For local development, set it in `.env` before starting Next.js. For release images, set the GitHub
Actions repository variable `NEXT_PUBLIC_GTM_MEASUREMENT_ID`; the existing release workflow forwards
it to the Dockerfile build argument of the same name. Supply that build argument explicitly when
building an image elsewhere. Rebuild and deploy the image after changing the ID: setting only the
Compose runtime environment does not change an already built browser bundle. See
[Next.js public environment variables](https://nextjs.org/docs/app/guides/environment-variables#bundling-environment-variables-for-the-browser).

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

The emergency switch is **Payload Admin → Site Settings → Legal → Disable Google Tag Manager**.
It defaults to off. Enable and save it to prevent GTM loading regardless of visitor consent once
the Site Settings cache refreshes. The existing revalidation hook uses stale-while-revalidate, so
an initial subsequent request may still receive the previous cached setting. An already running
container cannot be unloaded from an open page. Visitor withdrawal updates Consent Mode immediately;
withdrawing both optional categories also removes accessible `_ga`, `_ga_*`, and `_gcl_*` cookies
for the current host and parent domains. A full page reload is required to start without the
previously loaded script. Failed script loading does not interrupt browsing or cookie settings.

The Footer's **Cookie settings** button lets visitors review or withdraw consent. Closing the
banner or the settings dialog does not save a decision. If an `ec_preferences` cookie exists, its
region/language preference can be cleared in the Necessary section; this phase does not create
that preference or add language routing.

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
The public website still reads English. Language routes, populated relationship merging,
translated search queries, and sitemap/hreflang wiring belong to Phase 3.

Configure languages in `src/i18n/config.ts`. `source` is English; `translating` and `live` are
translation targets. The default contains only English and Global, so no translation work is
queued. Add the following server environment variables before enabling targets:

```dotenv
GOOGLE_TRANSLATE_API_KEY=
TRANSLATION_MONTHLY_CHAR_LIMIT=450000
JOBS_AUTORUN=false
REVALIDATE_SECRET=
```

`GOOGLE_TRANSLATE_API_KEY` enables the Google Cloud Translation Basic v2 REST adapter. An empty
key selects the offline identity stub and prevents real translation jobs from being queued.
`TRANSLATION_MONTHLY_CHAR_LIMIT` must be a positive safe integer. The independent usage Global
reserves deduplicated characters before sending a document, including its HTML markers. Failed
or partially sent attempts can therefore count conservatively; reservations are not refunded.
The counter resets on the first reservation in a new UTC calendar month, not when source content
is deleted. It is an application budget, not a measurement of the entire Google project's bill.

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
work-store invariant causes HTTP fallback. English paths are unchanged.

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
contains the read-only counter. Staff access reuses the existing authenticated-user boundary;
this application has no separate administrator role model. External translation/search writes
are denied; server Local API writes own these records.

There is no bulk backfill producer in this phase. After adding a target language, republish
existing English documents and save Globals/Media to enqueue them. The readiness denominator is
tracked requests, not an inventory of all eligible site content. Verify the existing content
inventory before changing a language to `live` in a later frontend release.

Explicit rules cover Products, categories, Blogs, Posts, Case Studies, Pages, Forms, Header,
Footer, visitor-facing Settings, and Media `alt`/`caption`. Media has no drafts, so each save is
publication; filenames, URLs, dimensions and storage metadata stay shared. Pages referenced by
Site Settings' Privacy Policy, Cookie Policy or Terms fields are excluded, and changing those
references removes prior plugin-owned translations. Sources without a public document URL,
such as Media, Forms, Globals and the frontend dictionary, do not receive fabricated search rows.

The source dictionary is `src/i18n/dictionaries/en.json`. Existing components continue to use
their English copy in this phase. `mergeTranslation` is a backend helper only; it returns English
by reference, merges the latest compatible ready checkpoint for configured target locales, and
returns `null` when no usable translation exists. Phase 3 callers must enforce public locale and
source visibility, handle the specified English redirect fallback, and partition caches by locale.
