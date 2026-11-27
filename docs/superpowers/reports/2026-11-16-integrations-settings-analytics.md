# Integrations settings and analytics implementation report

Implemented on `feature/i18n-consent`; no branch creation, push or merge. Final verification extended into 2026-11-17 local time. The initial tree was clean. Concurrent user commits `9c5d8d5` and `c332526` were preserved and are not part of this implementation. The three protected language-switcher files were never edited or staged by this task.

## Implementation commits

| Commit | Area |
| --- | --- |
| `e1d2cba` | Implementation plan |
| `8fda80c` | Environment contract and Compose cleanup |
| `be3484e` | Runtime translation configuration |
| `0792148` | Deployment, events, credentials, roles and historical references |
| `e0f6d02` | Explicit reviewed role-migration deployment prerequisite |
| `45780e2` | Typed business analytics events and consumers |
| `80591cb` | User roles, migration, encrypted integrations, resolver, generated artifacts and schema fixtures |
| `c52d6a3` | GTM settings passed through frontend providers and consent fixture updates |
| `70db5c2` | Four release flags without application/Compose consumers removed |

This report and the completed plan checklist are committed separately after the implementation commits.

## Files by area

- Roles/security: `src/access/isAdmin.ts`, `src/collections/Users/index.ts`, `src/migrations/20261116_user_roles.ts`, `src/utilities/secretBox.ts`.
- Persisted settings and normalization: `src/SiteSettings/config.ts`, `fields/index.ts`, new `fields/integrations.ts`, new `integrations.ts`, new `components/GoogleTranslateKeyStatus.tsx`; removed `components/GtmContainerStatus.tsx`.
- Generated schema/Admin map: `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js` (both regenerated with project commands).
- Frontend GTM: `src/app/(frontend)/[lang]/layout.tsx`, `src/providers/index.tsx`, `src/consent/ConsentProvider.tsx`, `src/consent/gtm.ts`.
- Translation: `src/plugins/translation/task.ts`, `dictionary.ts`, `hooks.ts`, `admin/TranslationStatus.tsx`, `rules/siteSettings.ts`, `scripts/translation-backfill.ts`.
- Events: new `src/consent/analytics.ts`, `src/components/Products/QuoteRequest/QuoteRequestForm.tsx`, `src/collections/Pages/blocks/Form/Component.tsx`, `src/components/Products/ProductActions/DownloadDialog.tsx`, `src/components/Products/ProductActions/index.tsx`, `src/Footer/ContactList.tsx`, new `src/Footer/ContactLink.tsx`.
- Environment/release: `src/utilities/env.ts`, `src/environment.d.ts`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `.github/workflows/release.yml`.
- Focused specs: new `integrations-settings`, `integrations-access`, `analytics-events`, `analytics-actions`, `translation-integrations-runtime` under `tests/int/`; updated `i18n-config`, `translation-dictionary-read`, `translation-status-phase4`, `quote-request-form`, `footer-component`, `header-component`, `site-settings-phase4`, `consent-provider`, `consent-ui`, `consent-panel-phase4`, `i18n-dictionary`.
- Required role fixture synchronization: `tests/int/blogs-schema.int.spec.ts`, `documents-references.int.spec.ts`, `media-references.int.spec.ts`, `products-db.int.spec.ts`; `tests/helpers/seedUser.ts`, `seedBlogsBeforeBuild.ts`, `seedPhase3LanguageBeforeBuild.ts`; `tests/e2e/media-documents.e2e.spec.ts`.
- Consent fixture plumbing: `playwright.config.ts` selects the existing isolated language/settings fixture for the cookie-consent spec; `seedPhase3LanguageBeforeBuild.ts` supplies `GTM-TEST000` through Site Settings.
- Documentation: `README.md`, `docs/deployment.md`, `docs/superpowers/specs/2026-11-15-i18n-region-consent-design.md`, supersession notices in the phase-1 cookie, phase-2 translation and phase-4 settings plans, this task's implementation plan and report.

## Security and migration review

Independent reviewers checked the installed canary's field-hook order, native form serialization, encrypted field reads/writes, user bootstrap, frontend serialization, translation runtime, and deployment settings. Findings were fixed before commits:

1. Payload strips denied field writes instead of rejecting them. Field `beforeValidate` hooks reject direct stored-field writes and unauthorized input before that stripping occurs. Global `beforeChange` only injects ciphertext/Last4, and deletes transient inputs. Public REST and editor reads are covered by real Payload/MongoDB operations.
2. Native read-only role fields are submitted with unchanged values. Editors may echo their existing role or the default editor value; effective role changes remain rejected, including when a caller supplies Local API `overrideAccess: true` with an editor request.
3. Payload canary defaults virtual fields to read-only. Native input fields explicitly use the public `admin.readOnly: false` option. A sanitized-config regression and real Admin browser check prove they remain editable for admins.
4. All four new integration text paths are explicitly excluded from translation extraction; schema-wide translation coverage passes.

The first-user test calls the actual `/api/users/first-register` endpoint and checks the resulting JWT contains `role: admin`. The migration's `up` updates all existing users, including already assigned editors, to admin; its real MongoDB test verifies all records. It logs the exact target and does not touch storage.

`payload migrate:status` successfully discovered `20261116_user_roles` under `src/migrations`, alongside the project's existing migrations. The installed MongoDB adapter uses directory discovery; there is no separate index to register. The migration was not applied to a developer or production database. Deployment still requires operators to review and apply it against the explicitly selected environment before using the new controls.

## Verification commands and outcomes

All application tests used local placeholders/stubs. Storage integration was disabled. Local MongoDB initially returned sandbox `connect EPERM`; reruns with approved localhost access passed. This was an environment restriction, not an application regression.

Final settings/security/consent run — **11 files, 82 passed**:

```sh
DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm test:int tests/int/integrations-settings.int.spec.ts tests/int/integrations-access.int.spec.ts tests/int/site-settings.int.spec.ts tests/int/site-settings-phase4.int.spec.ts tests/int/consent-state.int.spec.ts tests/int/consent-provider.int.spec.tsx tests/int/consent-ui.int.spec.tsx tests/int/consent-panel-phase4.int.spec.tsx tests/int/i18n-dictionary.int.spec.tsx tests/int/header-component.int.spec.tsx tests/int/translation-rules-coverage.int.spec.ts
```

Analytics — **6 files, 79 passed**:

```sh
DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/analytics-events.int.spec.ts tests/int/analytics-actions.int.spec.tsx tests/int/quote-request-form.int.spec.tsx tests/int/block-style-contracts.int.spec.tsx tests/int/footer-component.int.spec.tsx tests/int/quote-request-presentation.int.spec.tsx
```

Translation runtime/status — **2 files, 7 passed**; existing translation/backfill — **3 files, 53 passed**; env parser — **26 passed**:

```sh
DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/translation-integrations-runtime.int.spec.ts tests/int/translation-status-phase4.int.spec.ts
DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/translation-dictionary-read.int.spec.ts tests/int/translation-jobs.int.spec.ts tests/int/translation-backfill.int.spec.ts
DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/i18n-config.int.spec.ts
```

The translation MongoDB run used the project's isolated test database helper; its initially sandbox-blocked command was rerun with local access enabled.

Expanded required-role fixture regression — **71 passed, 9 failed, 1 skipped**:

```sh
DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm test:int tests/int/blogs-schema.int.spec.ts tests/int/documents-references.int.spec.ts tests/int/media-references.int.spec.ts tests/int/products-db.int.spec.ts
```

The Blogs/Documents/Media specs passed. All nine failures are in `products-db`: existing assertions expect `/products/...`, while existing i18n invalidation emits internal `/en/products/...` and locale variants. Revalidation implementation has no diff from the pre-task plan commit; the internal-path implementation predates this task (phase-4 commit `f54cfb3`). Only required role literals changed in this fixture. These stale assertions were reported and left outside scope. The skipped rollback test needs a MongoDB replica set; the available standalone server reports `transactionOptions=false`.

An earlier consolidated focused run also passed **19 files / 185 tests**, before adding the native virtual-field sanitizer regression:

```sh
DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/integrations-settings.int.spec.ts tests/int/site-settings.int.spec.ts tests/int/site-settings-phase4.int.spec.ts tests/int/consent-state.int.spec.ts tests/int/consent-provider.int.spec.tsx tests/int/consent-ui.int.spec.tsx tests/int/consent-panel-phase4.int.spec.tsx tests/int/i18n-dictionary.int.spec.tsx tests/int/header-component.int.spec.tsx tests/int/translation-rules-coverage.int.spec.ts tests/int/analytics-events.int.spec.ts tests/int/analytics-actions.int.spec.tsx tests/int/quote-request-form.int.spec.tsx tests/int/block-style-contracts.int.spec.tsx tests/int/footer-component.int.spec.tsx tests/int/quote-request-presentation.int.spec.tsx tests/int/translation-integrations-runtime.int.spec.ts tests/int/translation-status-phase4.int.spec.ts tests/int/i18n-config.int.spec.ts
```

Incremental checks also ran the newly added/modified settings, access, consent and rule specs alone or in smaller groups while implementing them. Expected initial red failures included missing modules/events, old env-based GTM lookup, the old fixed schema-path expectation and the native role echo behavior. Final focused runs supersede those intermediate failures.

Generated artifacts, migration discovery and static checks:

```sh
NODE_ENV=test DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm generate:types
NODE_ENV=test DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test corepack pnpm generate:importmap
NODE_ENV=test DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test JOBS_AUTORUN=false corepack pnpm payload migrate:status
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
git diff --check
```

All succeeded. Final TypeScript check has zero errors. Lint has zero errors and 10 pre-existing warnings in ignored header-design output, CaseStudies revalidation, Posts author population, and article-block-editor tests. Artifacts were regenerated twice, including after the virtual-field adjustment; no hand edits. The final stale-env search found no exact removed env names in active source/scripts/tests/config/Compose/example/README files.

### Targeted browser check (no e2e suite)

Used the Playwright CLI skill with a temporary local Next server:

```sh
NODE_ENV=test DISABLE_R2_STORAGE=true PLAYWRIGHT_TEST=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-integrations-browser-test-20261116 JOBS_AUTORUN=false NEXT_PUBLIC_SERVER_URL=http://localhost:3018 PAYLOAD_SECRET=<isolated-test-placeholder> corepack pnpm dev --port 3018 --hostname 127.0.0.1
```

Playwright CLI opened `/admin`, created the first account through native UI, opened Site Settings → Integrations, and checked that both admin key controls are enabled. It then created/logged in an editor through the local API, explicitly opened Integrations and confirmed GTM/limit inputs exist while key input, clear control and secret status do not. Screenshots/snapshots/session artifacts were not staged. The server/browser were stopped, the browser-only database was dropped after an exact-target guard, and Next's incidental tsconfig include change was reverted. No uploads were created by this check.

## Spec interpretations and mismatches

- No feature-level deviation. Additional runtime consumers in `hooks.ts` and `translation-backfill.ts` needed the new asynchronous enablement check; fixture types needed required `role`/monthly-limit values.
- `file_name` comes from the existing download URL basename without query/hash because `ProductDownload` has no original-filename field. No persisted model was expanded.
- Native virtual inputs require `admin.readOnly: false` in this canary. This uses its public configuration API; no private Admin DOM/CSS dependency was introduced.
- Native unchanged/default role echoes are accepted without allowing effective non-admin role changes, preserving existing Users access.
- `GHCR_REPOSITORY` has no deployment consumer. Documentation/example now use the real `ECOLITEA_IMAGE` selector.
- Docker/release values with Compose consumers were retained per the spec's repo-wide-reference rule: `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_CMS_URL`, `PAYLOAD_PUBLIC_APP_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, `NEXT_PUBLIC_IS_LIVE`, `NEXT_PUBLIC_ENABLE_DOCS`, `NEXT_PUBLIC_SKIP_BUILD_DOCS`, `NEXT_PUBLIC_SKIP_BUILD_HELPS`, `NEXT_PRIVATE_DRAFT_SECRET`, `NEXT_PRIVATE_REVALIDATION_KEY`, `REVALIDATION_KEY`. `R2_PUBLIC_URL` remains as required. Four enable flags found only in workflow declarations (CLOUD, COMMUNITY_HELP, PARTNERS, STYLEGUIDE) were removed from release.yml; unrelated ci.yml declarations were not changed. Unused Facebook Pixel release forwarding was also removed.
- Approved/historical design records can name removed env variables as historical context; active environment contracts and current deployment instructions no longer use them. Historical executed reports were not rewritten.
- Existing Products cache-path assertions do not match the earlier i18n implementation; see the failed fixture regression above.

## Remaining verification boundaries

No full e2e suite or production build was run, in line with targeted verification scope. No live Google Translate request, published GTM container, GTM Preview/GA4 Realtime delivery, production migration, production data or remote storage was tested or changed. Browser inspection covered native first-user creation and role-based Integrations controls; native full Site Settings replace/clear save was covered through real Payload Local API tests rather than a complete browser form submission. A direct GraphQL response test was not added; the same Payload field access protects that API boundary, while public REST and authenticated Local API reads have explicit coverage. The existing Products test failures and standalone-Mongo rollback skip remain as reported above.
