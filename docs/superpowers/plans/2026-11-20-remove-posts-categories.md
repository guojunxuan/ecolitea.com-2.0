# Remove Posts and Categories Implementation Plan

**Goal** — Retire the legacy Payload collections and serve Blogs as the sole article system, with permanent redirects and a safe migration preflight.

**Architecture** — Payload schemas and generated types define the new relationship targets. Next config owns the legacy URL mapping. The MongoDB migration inspects raw legacy data with pure planners and a shared read-only scanner, then applies only the allowed Archive and index changes.

**Tech stack** — Payload 4 canary, Next 16, MongoDB, Vitest, Playwright.

**Spec** — [Remove Posts and Categories](../specs/2026-11-19-remove-posts-categories-design.md)

## Constraints

- Work in `feature/admin-ui-macos`. Stage paths explicitly. Force-add this plan only.
- Preserve historical migration files. The installed adapter discovers timestamped modules in `src/migrations` by filename.
- The developer database `mongodb://127.0.0.1:27017/ecolitea2` is authorized for one read-only report. Migration tests use `createIsolatedTestDatabaseURI`; always report the exact database and storage target before writes.
- Keep production integrations disabled for tests. Preserve the active port-3000 service and the four untracked visual demos.
- Run only changed or added integration specs, Admin E2E, and one final run containing the website shell and Task 6 E2E specs.

## 1. Retire schemas and route consumers

- [ ] Add contract tests in `tests/int/remove-posts-categories-schema.int.spec.ts` and `tests/int/posts-redirects.int.spec.ts` covering schema references and all four HTTP 301 source shapes. Update `tests/int/i18n-archive.int.spec.tsx` for blog category selection, public and translated reads, and explicitly selected blogs. Remove the brand guard exceptions and update the Admin navigation assertion.
- [ ] Run `corepack pnpm test:int tests/int/{remove-posts-categories-schema,posts-redirects,admin-navigation,site-identity}.int.spec.ts tests/int/i18n-archive.int.spec.tsx` and confirm the old behavior fails.
- [ ] Remove `src/collections/{Posts,Categories.ts}` and the category revalidation hook, `src/app/(frontend)/[lang]/posts`, `src/app/(frontend)/(sitemaps)/posts-sitemap.xml`, the orphaned Post hero and related-post rendering, and the two legacy translation rules. Remove their config registrations.
- [ ] Change the Archive block config and renderer, Card, CollectionArchive, link factories and adapters, SEO/redirect/search plugins, public search projections, i18n readers, language target, admin preview, and sitemap configuration as specified. Keep Product search index support and use the blog publication and translation predicates for archives.
- [ ] Add the 301 rules to `redirects.ts`, ahead of the generic English canonical redirect.
- [ ] Regenerate `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` using `corepack pnpm generate:types` and `corepack pnpm generate:importmap`. Re-run the contract tests. Commit `feat(content): retire legacy posts and categories`.

## 2. Write the preflight and migration

- [ ] Create `tests/int/remove-posts-categories-migration.int.spec.ts` covering all blocking reference shapes, retained and orphan versions, clean plans, refusal with no writes, successful Archive/index cleanup, and `down`. Run that file first.
- [ ] Add `src/migrations/20261120_remove_posts_categories.ts`. Identify residual documents, live and historical relationship references, hidden Archive choices, redirects and translations with their document IDs and field paths. Use the preflight plan to issue guarded Archive updates, remove only derived Posts index rows and drop only retired collections. Report target and operation counts.
- [ ] Add `scripts/report-remove-posts-categories.ts` as a standalone CLI using the same scanner with a connection that disables schema initialization and hooks. Use the existing report-script convention for the explicit database URI and nonzero blocking exit.
- [ ] Run `corepack pnpm test:int tests/int/remove-posts-categories-migration.int.spec.ts` against isolated MongoDB. Run `DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2 DISABLE_R2_STORAGE=true corepack pnpm exec tsx scripts/report-remove-posts-categories.ts` once, preserving the actual report. Commit `feat(migrations): preflight and remove retired article collections`.

## 3. Move test fixtures onto Blogs

- [ ] Update only integration specs that exercise old collection slugs, routes or Post-only visuals. Preserve tests of historical migrations using intentionally legacy fixtures. Replace removed article behavior with corresponding Blog coverage where the test protects a shared feature.
- [ ] Update `tests/helpers/{blogFixtures,seedTask6ArchiveBeforeBuild}.ts` and `tests/e2e/{website-shell,task6-visual-matrix}.e2e.spec.ts`. Use valid Blog fixtures with their required content, category, cover and publication fields. Remove the legacy-only related-post case and its fixture from `tests/e2e/frontend.e2e.spec.ts`.
- [ ] Run the changed integration files selected from the staged and committed diffs, then TypeScript to catch fixture type drift. Commit `test(content): migrate article fixtures to blogs`.

## 4. Verify the complete change

- [ ] Run `DISABLE_R2_STORAGE=true corepack pnpm test:e2e tests/e2e/admin.e2e.spec.ts` on a reported isolated E2E target.
- [ ] Run `DISABLE_R2_STORAGE=true PLAYWRIGHT_PRESEED_TASK6_ARCHIVE=true corepack pnpm test:e2e tests/e2e/website-shell.e2e.spec.ts tests/e2e/task6-visual-matrix.e2e.spec.ts` once on a separate reported isolated target.
- [ ] Run `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm lint`, `PLAYWRIGHT_TEST=true corepack pnpm build` and `git diff --check`. Record commands and counts, the developer preflight, and any compatibility differences.
