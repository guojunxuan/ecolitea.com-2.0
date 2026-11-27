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
- Run only changed or added integration specs, Admin E2E, and the website shell and Task 6 E2E specs. The follow-up authorized one repeat of those two specs to verify the selector and stale header assertions.

## 1. Retire schemas and route consumers

- [x] Add contract tests in `tests/int/remove-posts-categories-schema.int.spec.ts` and `tests/int/posts-redirects.int.spec.ts` covering schema references and all four HTTP 301 source shapes. Update `tests/int/i18n-archive.int.spec.tsx` for blog category selection, public and translated reads, and explicitly selected blogs. Remove the brand guard exceptions and update the Admin navigation assertion.
- [x] Run `corepack pnpm test:int tests/int/{remove-posts-categories-schema,posts-redirects,admin-navigation,site-identity}.int.spec.ts tests/int/i18n-archive.int.spec.tsx` and confirm the old behavior fails.
- [x] Remove `src/collections/{Posts,Categories.ts}` and the category revalidation hook, `src/app/(frontend)/[lang]/posts`, `src/app/(frontend)/(sitemaps)/posts-sitemap.xml`, the orphaned Post hero and related-post rendering, and the two legacy translation rules. Remove their config registrations.
- [x] Change the Archive block config and renderer, Card, CollectionArchive, link factories and adapters, SEO/redirect/search plugins, public search projections, i18n readers, language target, admin preview, and sitemap configuration as specified. Keep Product search index support and use the blog publication and translation predicates for archives.
- [x] Add the 301 rules to `redirects.ts`, ahead of the generic English canonical redirect.
- [x] Regenerate `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` using `corepack pnpm generate:types` and `corepack pnpm generate:importmap`. Re-run the contract tests. Commit `feat(content): retire legacy posts and categories`.

## 2. Write the preflight and migration

- [x] Create `tests/int/remove-posts-categories-migration.int.spec.ts` covering all blocking reference shapes, retained and orphan versions, clean plans, refusal with no writes, successful Archive/index cleanup, and `down`. Run that file first.
- [x] Add `src/migrations/20261120_remove_posts_categories.ts`. Identify residual documents, live and historical relationship references, hidden Archive choices, redirects and translations with their document IDs and field paths. Use the preflight plan to issue guarded Archive updates, remove only derived Posts index rows and drop only retired collections. Report target and operation counts.
- [x] Add `scripts/report-remove-posts-categories.ts` as a standalone CLI using the same scanner with a connection that disables schema initialization and hooks. Use the existing report-script convention for the explicit database URI and nonzero blocking exit.
- [x] Run `corepack pnpm test:int tests/int/remove-posts-categories-migration.int.spec.ts` against isolated MongoDB. Run `DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2 DISABLE_R2_STORAGE=true corepack pnpm exec tsx scripts/report-remove-posts-categories.ts` once, preserving the actual report. Commit `feat(migrations): preflight and remove retired article collections`.

## 3. Move test fixtures onto Blogs

- [x] Update only integration specs that exercise old collection slugs, routes or Post-only visuals. Preserve tests of historical migrations using intentionally legacy fixtures. Replace removed article behavior with corresponding Blog coverage where the test protects a shared feature.
- [x] Update `tests/helpers/{blogFixtures,seedTask6ArchiveBeforeBuild}.ts` and `tests/e2e/{website-shell,task6-visual-matrix}.e2e.spec.ts`. Use valid Blog fixtures with their required content, category, cover and publication fields. Remove the legacy-only related-post case and its fixture from `tests/e2e/frontend.e2e.spec.ts`.
- [x] Run the changed integration files selected from the staged and committed diffs, then TypeScript to catch fixture type drift. Commit `test(content): migrate article fixtures to blogs`.

## 4. Verify the complete change

- [x] Run `DISABLE_R2_STORAGE=true corepack pnpm test:e2e tests/e2e/admin.e2e.spec.ts` on a reported isolated E2E target.
- [x] Run `DISABLE_R2_STORAGE=false PLAYWRIGHT_PRESEED_TASK6_ARCHIVE=true corepack pnpm test:e2e tests/e2e/website-shell.e2e.spec.ts tests/e2e/task6-visual-matrix.e2e.spec.ts` on a reported isolated target. Playwright overrides the S3 endpoint and credentials with its loopback emulator and placeholders.
- [x] Run `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm lint`, `PLAYWRIGHT_TEST=true corepack pnpm build` and `git diff --check`. Record commands and counts, the developer preflight, and any compatibility differences.

## Verification notes

- The five contract files in §1 reproduced 11 failures and passed all 22 tests after the changes. The 47 changed integration files had 544 passes, 2 stale expectations, and 1 skip on the first combined run. After the fixture expectations were corrected, 546 passed and 1 skipped. The skipped test requires a MongoDB replica set for the product-category rollback. The migration's five tests passed against an isolated standalone database.
- `generate:types` updated the generated schema. `generate:importmap` found no new imports. Next route types were regenerated for both normal and Playwright output directories after the old routes were removed.
- The read-only developer preflight reported five blockers, two Posts and three Header/Footer references. It found five retained Post versions, zero orphan versions or Categories, and no Archive, redirect, or translation blockers. The unapplied plan listed 30 Archive block updates, zero derived index rows, and four retired namespaces. The script returned exit code 1 and made no writes.
- The canary discovers migrations directly in `src/migrations`. The historical `20261021_collection_owned_block_slugs` migration still needs the old `posts` adapter model. Complete pending historical migrations on the prior schema before using the new phase. Preserve those historical files.
- The preflight scans the sources in spec §4.1. Historical rich text in `media.caption` and `forms.confirmationMessage` could also use the legacy link defaults and is outside this scan. MongoDB namespace drops run outside Payload's transaction. Quiesce content writes before executing the migration. Rollback changes eligible empty collection-populated Archives and cannot identify the origin of an otherwise identical Blog Archive created after migration. The local tests used standalone MongoDB.
- The first visual run passed 6 tests and failed 2, leaving 17 serial cases unexecuted. Task 6's category locator matched a Blog title as well. Website Shell expected `0.9` opacity, while the pre-phase-2 CSS already specified `0.8`. The corresponding desktop opacity and blur assertions were aligned with the same existing tokens in a separate test-only commit.
- The authorized repeat passed all 25 cases, including all 17 previously unexecuted cases. The four Task 6 cases and 21 Website Shell cases ran with run-scoped MongoDB and the local S3 emulator. Both admin-only runs passed five tests each.
- Final TypeScript, lint, and build exited successfully. Lint reported 17 warnings in unchanged files. The build used an isolated MongoDB database, local font fixtures, and `PLAYWRIGHT_TEST=true` to preserve the development output directory.
