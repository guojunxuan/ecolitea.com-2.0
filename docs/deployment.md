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
