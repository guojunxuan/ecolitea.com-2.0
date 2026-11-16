# Phase 4 implementation and verification

Implemented on `feature/i18n-consent`, following [the Phase 4 plan](../plans/2026-11-16-phase4-settings-language-and-panels.md). No branch switch in the main checkout, dependencies, lockfile changes, data migration, or production operations.

## Ownership and behavior

- Payload Site Settings owns language status, regions and optional Cookie explanations. The 18-language catalog and Google target-code mapping remain in code.
- Brand, Contact & Social, Legal & Privacy, Integrations and Language use unnamed presentation groups. The explicit persisted-path test retains every original field name/path. Existing `newsletter` stays named.
- Proxy admits catalog language prefixes; the layout enforces live availability, including languages enabled after build. Empty settings keep English URLs/content/SEO, with the EN entry and Global choice.
- Saving Site Settings immediately invalidates its cache, translated sitemaps and the internal language layout. Full backfill remains an explicit operation. Removing/disabling a language retains translations; referenced region rows must be reassigned/removed before disabling it.
- Translation usage and completion share the backfill public-source inventory. Configured off languages retain statistics. Status cells use Payload's native `SelectInput`, public `useField`/`useFormFields` and exported `FieldPathContext`, bound to `languages.N.status`; the native array owns adding/removing language codes. Server validation protects all writes.
- Localized Site Settings supplies Cookie explanations; missing values retain dictionary defaults. Native dialogs coordinate through existing panel events. Mobile Cookie footer buttons stay stacked, and the banner's equal primary actions sit above its settings text button.
- Both long explanations use the shared measured `ConsentDescription`: clamped text exposes an accessible Read more/Read less control. The mobile banner's full explanation is reachable inline.

## Delegation and integration

C was implemented in `/tmp/ecolitea-phase4-header` (`phase4/header`), original commit `384b080`. D was implemented in `/tmp/ecolitea-phase4-consent` (`phase4/consent`), original commit `ef903b6`. Each branched from the main checkout's then-current HEAD; neither edited the main checkout. Commits were cherry-picked back. C's two import/context conflicts retained the runtime context contract and GlobeIcon. Both sets of component tests were rerun after integration (C 16/16; D 34/34 before later banner coverage).

A separate read-only reviewer found off-language statistics missing from the initial summary and requested real native-field save/reload coverage. Both were addressed. The real browser check exposed the native field's inherited path context; the installed public `FieldPathContext` declaration documents the required wrapper, now covered by a context-aware component test and browser persistence check.

## Authorized assertion changes

1. `site-settings.int.spec.ts`: only the five tab names/order changed to the Section 0 layout. All field-name, validation, required/default and access assertions stayed unchanged. Added `site-settings-phase4.int.spec.ts` proving the complete original persisted path set survives the regrouping.
2. `i18n-routing.int.spec.ts`: translating moved from a Proxy 404 expectation to pass-through. Catalog `zh-tw` also passes; non-catalog `/xx/a` and `/en-gb` remain Proxy 404. Added layout assertions for translating `fr`, off `de`, and off `zh-tw`; browser assertions cover otherwise valid `/phase3-ready` paths and final HTTP 404.
3. The four `i18n-sitemaps.int.spec.ts` cache structure assertions now expect the stable settings key and `global_site-settings` plus translation tags. XML, URLs, hreflang and readiness assertions are unchanged. Added save-hook invalidation assertions and an off → live → off browser check for ready sitemap URLs.
4. `translation-jobs.int.spec.ts`: only the scheduled Product fallback path changed from `/products/tea/scheduled` to `/en/products/tea/scheduled`, in the separately requested `test(translation): expect internal locale revalidation paths` commit. Phase 3 Task 4/spec §5/spike intentionally changed the physical invalidation path, but that Phase 2 spec had not been in Phase 3's targeted run. Every other assertion in that file is unchanged.
5. C/D replaced no prior consent/URL/access assertions. Setup now supplies runtime settings, opens Necessary before its existing Clear action, and stubs ResizeObserver in jsdom. The native-modal mutual-exclusion browser setup programmatically invokes the otherwise inert Footer trigger; its exclusivity assertions remain unchanged. New assertions cover disclosure, form-path context, full mobile banner text and persistence.

## Verification commands and evidence

All integration databases are local and contain `phase4`. Each MongoDB fixture reports its exact generated target before writes/cleanup. Browser configuration generates a fresh run-scoped database from `mongodb://127.0.0.1:27017/ecolitea2-phase4-e2e`. Test files and S3 credentials are isolated placeholders. Port 3000 and developer database `ecolitea2` were not used or stopped. Google script requests are fulfilled locally and `GOOGLE_TRANSLATE_API_KEY=''` prevents provider use.

Final targeted integration command:

```sh
DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-phase4 GOOGLE_TRANSLATE_API_KEY='' corepack pnpm test:int tests/int/i18n-*.int.spec.* tests/int/translation-*.int.spec.* tests/int/site-settings*.int.spec.ts tests/int/language-*.int.spec.tsx tests/int/consent-*.int.spec.*
```

Result: 35 files, 235 passed, 0 failed. Log: `/tmp/phase4-int-complete.log`. After the final Admin review, only affected specs were rerun as requested: `DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/site-settings-hook.int.spec.ts tests/int/translation-table-phase4.int.spec.tsx tests/int/translation-status-phase4.int.spec.ts tests/int/site-settings-phase4.int.spec.ts` → 4 files, 8 passed, 0 failed; `/tmp/phase4-admin-review-tests-final.log`. This includes the added zero/quarter usage-fill assertion and physical cache-pattern assertion.

```sh
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
DISABLE_R2_STORAGE=true corepack pnpm generate:types
DISABLE_R2_STORAGE=true corepack pnpm generate:importmap
```

TypeScript: exit 0 (also rerun after final Admin changes in `/tmp/phase4-tsc-review.log`). Lint: exit 0, 0 errors and 10 pre-existing warnings (unrelated output scripts, Case Studies/Posts hooks and article-block-editor test). Final affected-file ESLint also passed without warnings (`/tmp/phase4-lint-review.log`). Generated artifacts were regenerated with the project commands. Logs: `/tmp/phase4-tsc-complete.log`, `/tmp/phase4-lint-complete.log`, `/tmp/phase4-types-final.log`, `/tmp/phase4-importmap-final.log`.

Browser command environment (all values below are test-only):

```sh
DISABLE_R2_STORAGE=false E2E_DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-phase4-e2e PLAYWRIGHT_PORT=3144 PLAYWRIGHT_STORAGE_PORT=9144 R2_BUCKET=phase4-test-bucket GOOGLE_TRANSLATE_API_KEY='' REVALIDATE_SECRET=phase4-test-revalidation PAYLOAD_SECRET=phase4-test-payload-secret CRON_SECRET=phase4-test-cron corepack pnpm test:e2e tests/e2e/language-switcher.e2e.spec.ts tests/e2e/cookie-consent.e2e.spec.ts --reporter=line
```

Result: 10 passed, 0 failed; 1440/390 panels, runtime language transitions, default English SEO, final unavailable-locale 404, editable Cookie copy, Admin native status save/reload and tab screenshots. Log: `/tmp/phase4-e2e-panels4.log`.

After the requested banner Read more addition, the same environment ran:

```sh
corepack pnpm test:e2e tests/e2e/cookie-consent.e2e.spec.ts --reporter=line
```

Result: 6 passed, 0 failed. Added full-description expansion geometry and regenerated the mobile screenshot. Log: `/tmp/phase4-e2e-cookie-complete.log`.

English regression used the same test-only environment with `PLAYWRIGHT_PORT=3145 PLAYWRIGHT_STORAGE_PORT=9145`:

```sh
corepack pnpm test:e2e tests/e2e/website-shell.e2e.spec.ts tests/e2e/frontend.e2e.spec.ts --reporter=line
```

Result: 23 passed, 0 failed, in `DISABLE_R2_STORAGE=false` mode against the local S3 server. Log: `/tmp/phase4-e2e-english-final.log`. The existing mobile logo-centering assertion caught unequal left/right reserved widths; the Header grid was balanced and the original assertion retained.

The browser webServer runs `pnpm build` (the project `payload build --webpack` script and postbuild sitemap command) before starting its isolated standalone server. These builds used the run-scoped phase4 DB and `.next-e2e`, leaving the developer `.next` output untouched. Build warnings are the existing MongoDB package dynamic-import warning; browser navigation can also log a canceled destination stream while tests pass.

Final affected Admin/cold-request command used the same browser environment:

```sh
corepack pnpm test:e2e tests/e2e/language-switcher.e2e.spec.ts --grep 'live locale changes' --reporter=line
```

Result: 1 passed, 0 failed (cold off → live → off; native save/reload; visible zero-usage track; final 1440/390 screenshots). Log: `/tmp/phase4-e2e-admin-layout.log`; desktop/mobile Language screenshots were regenerated after the three requested visual corrections.

Cold-run verification identified a physical-path detail masked by warmed translated pages: generated Next metadata tags include `/(frontend)/[lang]/layout`. The Site Settings hook now uses `revalidatePath('/(frontend)/[lang]', 'layout')`. A group-free pattern targeted an unused tag and left cold off-state 404s cached; the cold off → live → off browser case specifically verifies the corrected boundary. The failed diagnostic run is `/tmp/phase4-e2e-admin-complete.log`; it was not accepted as a passing result.

## Screenshots

- `/tmp/phase4-language-1440.png`
- `/tmp/phase4-language-390.png`
- `/tmp/phase4-cookie-banner-1440.png`
- `/tmp/phase4-cookie-banner-390.png`
- `/tmp/phase4-cookie-banner-expanded-390.png`
- `/tmp/phase4-cookie-settings-1440.png`
- `/tmp/phase4-cookie-settings-390.png`
- `/tmp/phase4-site-settings-language-1440.png`
- `/tmp/phase4-site-settings-language-390.png`
- `/tmp/phase4-site-settings-tabs-1440.png`
- `/tmp/phase4-site-settings-tabs-390.png`

## Deviations and limitations

- The separately requested stale Phase 2 assertion correction adds one test-only commit beyond the plan's seven item commits.
- Code and fixture defects encountered during verification were fixed rather than relaxing existing assertions: fractional banner reservation is rounded upward, the navigation logo is centered, and native field scope is explicit. An initial overlong run-scoped MongoDB name was shortened before rerunning; the startup failure was environmental.
- Official beta Payload reference pages were attempted, but unavailable to the web tool; the relevant installed public types, component declarations and existing configuration patterns were inspected. Installed Next.js caching, invalidation and static-parameter guides were read before those changes.
- No Google integration, production deployment or production services were exercised, as requested. No additional broad test suite was run outside the plan. Screenshots, Playwright output, local uploaded fixture files and worktree links are excluded from commits.
