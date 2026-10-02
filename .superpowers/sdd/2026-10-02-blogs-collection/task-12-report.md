# Task 12: final publishing and responsive gates

Status: DONE_WITH_CONCERNS — automated gates pass; independent local media transport defect remains documented.

## Fix round 1 — published media references

- Review found the fixture cleanup scanned only `draft: true`; Payload returns the latest version for that query, so a new draft could hide a media reference still present on the published Page, CaseStudy, or Post.
- Cleanup now scans each reference-owning collection twice: the published view (`draft: false`) and the latest draft view (`draft: true`). A match in either view aborts deletion and names the collection, document, and version inspected.
- Added a real Payload/Mongo regression: create a published Page with a media ID, save a newer draft with that field cleared, and assert `cleanupBlogs` refuses to proceed and leaves the fixture media present. RED: before the fix, cleanup resolved and deleted the media. GREEN: after the fix, the focused test passes.
- Test data used a unique local run-scoped database such as `mongodb://127.0.0.1:27017/task12-b12b6683-551-e2e`; R2 was disabled and the test dropped that database in teardown. Blog browser E2E used `mongodb://127.0.0.1:27017/ecolitea2-task12-fixround2-e2e`, R2 disabled, and passed all 6 tests including the fixture cleanup teardown.
- Verification for this fix: focused integration 1/1 PASS; `corepack pnpm exec tsc --noEmit --incremental false` PASS; Blog E2E 6/6 PASS. The first E2E build attempt surfaced TypeScript errors in the new test’s dynamic fixture fields; those casts were corrected before the successful rerun.

## Changes

- Added run-scoped Blog prebuild fixture and six browser journeys covering category order/counts/current state, featured article, listing pagination, category breadcrumb, all five content blocks, hero/author, TOC keyboard anchors, mobile More navigation, related ordering, anonymous draft/future filtering, XML sitemap, robots, authenticated draft preview and exit.
- Seed creates three categories (third required to exercise More), fourteen visible Blogs, a draft and future Blog, author and local PNG. No production seed script.
- Added 1440/1152/768/390 screenshots and overflow assertions, including a 158-character unbroken TOC heading and articles with no TOC.
- Fixed long TOC labels overflowing their grid, centered no-TOC article content at intermediate desktop widths, and restored desktop Blog archive to three columns (featured spans two); tablet remains two and mobile one. Posts layout is unchanged.
- Updated Header isolated schema to include newly allowed Blog relationships; updated Footer relation expectation; removed unsafe optional-chain non-null assertions from Task 10 tests.
- Added current CTA heading/description to the existing Task 6 visual matrix; updated its stale Banner span-label expectation to the current accessible note label.
- Playwright honors explicit DISABLE_R2_STORAGE=true; default full suite keeps its local S3 mock. Prebuild clears only `.next-e2e/cache` to prevent cross-database cache contamination. Global teardown selects local storage before loading Payload, checks external references, and deletes exact fixture IDs.

## Environment and data safety

Every Blog fixture operation reports and validates local host, run-scoped database, and storage mode before writes/deletes. Actual host is `127.0.0.1:27017`.

- Developer read-only CTA audit: `ecolitea2`, DISABLE_R2_STORAGE=true. Payload API returned 4 Pages and 3 CaseStudies; affected legacy `cta.richText` document IDs: none. No developer content rewritten.
- Integration API gate: `ecolitea2-task12-int`; existing DB schema tests create UUID-prefixed dedicated databases and drop only those.
- Focused E2E databases: `ecolitea2-task12-blogs-e2e` and `ecolitea2-task12-blogs2-e2e` through `ecolitea2-task12-blogs5-e2e`, matching run IDs `task12-blogs`, `task12-blogs2` through `task12-blogs5`; DISABLE_R2_STORAGE=true.
- Full production build: `ecolitea2-task12-build`, DISABLE_R2_STORAGE=true.
- Full E2E and final rerun: `ecolitea2-task12-full-e2e`, `ecolitea2-task12-final-e2e`; focused matrix `ecolitea2-task12-matrix-e2e`, matching run IDs `task12-full`, `task12-final`, `task12-matrix`; Blog prebuild/cleanup disable R2; legacy storage tests use local S3 at `http://127.0.0.1:9001` with placeholder credentials and non-routable public media URL.
- Initial sandbox connections failed with `connect EPERM 127.0.0.1:27017`; approved escalation allowed the same isolated local targets to run. This was an environment failure.
- Abandoned `task12-blogs` and `task12-blogs3` fixture data and their exact local PNGs were removed through Payload after reference checks. Run2 cleanup happened in its test hook; run4/5 global cleanup succeeded. User `.claude/`, `.playwright-cli/`, and `output/` preserved.

## RED / GREEN evidence

1. Focused pre-change tests (`corepack pnpm exec vitest run --config vitest.config.mts tests/int/header-conditional-validation-db.int.spec.ts tests/int/footer-config.int.spec.ts`): RED — Header `InvalidFieldRelationship ... 'blogs'`; Footer expected 4 relation targets but received 6. After updates plus Blog integration test: GREEN — 3 files, 27 tests.
2. First E2E launcher omitted project's `tsx/esm` loader: test loading failed (`next/cache` module resolution) after build. Corrected to standard `corepack pnpm test:e2e`.
3. Run2: homepage/pagination passed, category card count failed (expected 1, received 0). `.next-e2e/server/app/blogs/category` still contained prior run's category paths, proving cache reuse across databases. Clearing test cache fixed it; run3 listing/category passed.
4. Run3: real local media response failed image naturalWidth (0). Independent HTTP request confirmed status 500 and server error `Cannot find module 'node:fs/promises'` at `chunks/9966.js:1:45510`, `bQ.fromFile` at `chunks/5458.js:435:40311`. This unresolved local file-route integration is separately documented below.
5. Run4 with exact local PNG intercepted for UI: listing and full visibility/preview/sitemap test passed; all 4 responsive tests failed document overflow after opening long TOC. After `minmax(0, 1fr)` and `overflow-wrap: anywhere`: run5 GREEN — 6 passed (1.4m), geometry logs show document widths exactly 1440/1152/768/390 and `overflowing: []`.
6. Manual run5 screenshot at 1152px showed no-TOC reading content starting at left gutter despite centered hero. Added conditional full-column centered reading layout and browser center-distance assertion; GREEN in the complete suite, including the four center-distance assertions.

## Gates

- `DISABLE_R2_STORAGE=true corepack pnpm generate:types`: PASS; no generated diff.
- `DISABLE_R2_STORAGE=true corepack pnpm generate:importmap`: PASS; no new imports.
- `DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-task12-int corepack pnpm test:int`: PASS — 63 files, 598 tests, 34.44s.
- Focused TOC component suite after wrap fix: PASS — 3 tests.
- Focused Blog E2E run5: PASS — 6 tests, four viewport sizes.
- `corepack pnpm exec tsc --noEmit --incremental false`: PASS after fixture typing corrections.
- `corepack pnpm lint`: PASS — 0 errors, 7 existing warnings (five in user output scripts, two existing collection hooks).
- `DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-task12-build corepack pnpm build`: PASS with existing file-type webpack warning, including next-sitemap postbuild. Final rerun after no-TOC and three-column CSS also PASS, including next-sitemap postbuild (log `/tmp/task12-final-build.log`, exit 0).
- Initial complete E2E: 39 passed, 1 failed, 1 skipped in 2.1m. Only failure was the stale Banner span-label test; its serial successor was skipped. Corrected to current role=note aria-label and reran all 4 Task6 tests: PASS (1.5m), including static Posts first-page checks with PLAYWRIGHT_PRESEED_TASK6_ARCHIVE=true. Final complete rerun after approved desktop grid change: PASS — **41/41**, 2.1m, no skipped/expected-failure cases in this run. Command: `DISABLE_R2_STORAGE=false DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-task12-final-e2e PLAYWRIGHT_E2E_RUN_ID=task12-final PLAYWRIGHT_PRESEED_TASK6_ARCHIVE=true corepack pnpm test:e2e --reporter=line`.

## Visual comparison

Rendered both supplied HTML references at 1440/768/390 and inspected Blog UI screenshots. Confirmed centered reading hierarchy, wide hero, sidebar/collapsible TOC, featured listing span and responsive card grids. The initial list screenshot revealed a plan/reference mismatch: Task7 said two columns, but design spec §5.3.3 plus HTML reference specifies featured span two within a three-column desktop grid. The controller explicitly resolved this in favor of spec/reference, so desktop grid is now three columns with geometry assertions; no silent plan reinterpretation. The fixture intentionally uses one flat green local PNG; this verifies media geometry rather than photographic art direction. Shared site shell differs from HTML reference placeholders. Full-page screenshots are test output only, never staged.

## Known limitations

- Local `/api/media/file/e2e-blogs-task12-blogs3.png` returned HTTP 500 (`node:fs/promises` missing from bundled file-type path). Blog UI tests intercept only their own fixture PNG via Playwright. Their green result does not validate local media transport. Existing local S3 transport remains part of the full E2E gate. No unrelated bundler/package changes made.
- Payload emits missing email-adapter and Mongoose deprecation warnings; React/jsdom suite emits existing scrollTo notice. Preview negative requests can cause Next `destination stream closed early` logs; assertions still pass.
- Existing redirect suite retains separate expected-failure tracking for duplicate raw Location headers; its HTTP 308 and destination assertions remain normal tests.

## Self-review

Reviewed every changed source/test and fixture cleanup path. `git diff --check` passes. Generated artifacts are unchanged. No dependency or lockfile changes. Final run teardown logged the exact isolated database with R2 disabled; local `media/` is empty and port 3001 has no remaining listener. Original unrelated untracked `.claude/`, `.playwright-cli/`, `output/` remain untouched.

Final tsc and lint of every changed TypeScript file pass without output; full lint remains 0 errors/7 pre-existing warnings. The last build retry initially could not execute because automatic approval review hit the account usage limit (not an unsafe-action decision). User later requested continuation; the same isolated command was approved and rerun.


## Files changed

- `playwright.config.ts`
- `src/app/(frontend)/blogs/[slug]/page.module.css`
- `src/components/CollectionArchive/index.module.css`
- `src/components/TableOfContents/index.module.css`
- `tests/e2e/blogs.e2e.spec.ts`
- `tests/e2e/task6-visual-matrix.e2e.spec.ts`
- `tests/helpers/blogFixtures.ts`
- `tests/helpers/seedBlogsBeforeBuild.ts`
- `tests/helpers/cleanupBlogsAfterTests.ts`
- `tests/int/blog-site-integration.int.spec.ts`
- `tests/int/footer-config.int.spec.ts`
- `tests/int/header-conditional-validation-db.int.spec.ts`

Test logs remain in `/tmp/task12-*.log`; final screenshots remain in ignored `test-results/`, with earlier visual review copies under `/tmp/task12-visual-final/`. The report is a local SDD artifact under ignored `.superpowers/` and is force-added explicitly for this task's requested audit trail.
