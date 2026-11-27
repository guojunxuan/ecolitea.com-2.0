# Final whole-feature review fixes

Base: `03d9abd`. Status: DONE — all five Important and both Minor findings addressed; final integration, typecheck, lint, production build, and targeted browser gates pass.

## Findings and changes

1. **Unavailable RichText Blog relationship** — `internalDocToHref` accepts missing/unpopulated values and returns the existing `#` fallback. It preserves the link text and never discloses the inaccessible target slug. Real Payload tests create a public parent linking to a draft, future-published, or deleted Blog, then read it anonymously with `depth: 2`. All three return the target string ID. Evidence refines the original finding: this installed Lexical converter catches the thrown error, logs it, and omits the node (empty paragraph), rather than rejecting `renderToStaticMarkup` as a whole.
2. **Wide Media/CTA** — the article grid permits a 900px content container, while Prose, ordinary Media, Banner, and Key Takeaways retain their own 736px limits. Article Media and CTA do not subtract page gutters inside that container. The intermediate desktop layout retains room for the TOC; heading-free content remains centered. Page-context block behavior is unchanged.
3. **Category snapshots in Search** — `resolveBlogSearchResults` normalizes the indexed Blog results and resolves all category IDs in one anonymous Payload query. Category rename uses the current title/slug; a deleted category yields no category link. Existing stored snapshots need no migration. Real Payload regression creates the Search index through the installed Search plugin, renames/deletes the category, and resolves the original snapshot; component tests verify public links.
4. **Cached redirect target slug** — Blog redirect targets resolve their stable ID through an uncached anonymous, published Payload read, even if the cached redirect contains a populated document. The resolved slug supplies the 308 destination. The Blog write/delete hooks also immediately expire the shared `redirects` tag when slug, publication status, or publication date changes, or a published Blog is deleted. That tag is present on the actual cached 308 response, so the next request blocks for the current destination. Ordinary published content edits do not invalidate redirects. Explicit URLs and Post redirects retain their existing behavior.
5. **Sticky TOC/Header overlap** — sticky top uses `--website-anchor-offset`, the shared header height plus 24px, matching the reference offset.
6. **Minor: category detail cache** — detail bodies now carry `blog-categories` so category hook invalidation reaches their populated category presentation.
7. **Minor: Open Graph excerpt** — the Blog detail Open Graph description uses the same `meta.description ?? excerpt` fallback as the standard description.

## RED / GREEN evidence

- RichText: three real Payload anonymous relationship tests failed before the fix; each returned a string relationship ID and SSR output omitted the link. After the fix all three preserve the fallback link/text. RED `/tmp/final-fix-red-db.log`; GREEN `/tmp/final-fix-green-db.log` and full integration log.
- Search categories: both public SearchPage tests failed before the fix because `Old title` still linked to `/blogs/category/old-slug` after rename/deletion. Both pass after current-ID resolution. Added actual Search-plugin index lifecycle coverage; all schema tests pass.
- Redirects: warm populated cache regression returned `/blogs/tea-notes` after the target became `renamed-tea`; now returns `/blogs/renamed-tea`. Added production browser regression warming the actual cache before an authenticated Admin API PATCH, exercising the real Payload hook and the following anonymous request.
- Wide blocks: Luna ran the RED 1440px production browser test. Prose measured 736px, Media 640px, CTA 640px; both required `wide > prose + 30px` and failed. Luna GREEN passed at 1440px and 1152px; both Media and CTA exceed Prose by more than 30px.
- Sticky TOC: the same Luna RED run scrolled the article and could not satisfy first-link top >= header height within 5 seconds. Luna GREEN passed the offset assertion and successful Playwright trial click, followed by keyboard navigation.
- Minor cache/OG: pre-fix unit tests failed on missing `blog-categories` tag and missing OG excerpt respectively. Both pass.

## Verification

- Focused integration: 9 files / **101 passed** (`/tmp/final-fix-focused.log`).
- Payload schema suite with actual Search plugin: **15 passed** (`/tmp/final-fix-green-db.log`).
- Final full integration: **64 files / 608 passed**, 46.21s (`/tmp/final-fix-int-final.log`). Earlier aggregate run passed 607 tests before the additional ordinary-edit invalidation regression.
- `corepack pnpm exec tsc --noEmit --incremental false`: final PASS (`/tmp/final-fix-tsc3.log`), also passed after each implementation stage.
- `corepack pnpm lint`: PASS, 0 errors / 7 existing warnings (`/tmp/final-fix-lint.log`).
- `DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-final-fix-build corepack pnpm build`: final PASS, exit 0, including next-sitemap postbuild (`/tmp/final-fix-build-final.log`).
- First Luna GREEN: 8 passed / 1 failed / 1 not run. Responsive/detail/listing/publication journeys passed. The serial category rename/delete Search journey was confirmed by the final green4 run. Warm-cache slug rename still failed, because Next cached the entire initial 308 response. Final Luna green4: **4/4 PASS**, including initial 308, existing raw-header expectation, real Admin PATCH with warm 308 to the renamed slug and target 200, and category Search rename/delete.
- `git diff --check`: PASS.
- No persisted schema changed; no generated artifact or dependency/lockfile changes required.

## Environment and operational boundaries

All writes use isolated local MongoDB at `127.0.0.1:27017`; all runs set `DISABLE_R2_STORAGE=true`. Schema fixtures disable local uploads and drop only their UUID database. No production data, storage, credentials, or infrastructure are changed.

- RichText RED database: `ecolitea2-blogs-schema-560351e1-3830-445a-849d-251278370f1e` (dropped by teardown).
- Full integration database: `ecolitea2-final-fix-int`; Blog schema sub-suite: `ecolitea2-blogs-schema-22fbc3b1-9c6a-445f-9676-47eb39271809` (dropped); cleanup regression: `task12-2ccd1aaf-bca-e2e` (dropped).
- Final integration Blog schema database: `ecolitea2-blogs-schema-2eb8eb4f-9ef1-443a-b074-f933249915c3` (dropped); cleanup regression: `task12-fd2e1256-e61-e2e` (dropped).
- Build database: `ecolitea2-final-fix-build`.
- Luna RED browser database: `ecolitea2-final-fix-red-e2e`, run `final-fix-red`, local fixture storage; Luna verified zero matching Blog/category/user/media fixtures after teardown.
- Luna GREEN browser database: `ecolitea2-final-fix-green-e2e`, run `final-fix-green`, local fixture storage. Luna confirmed zero matching fixture documents after teardown.
- Final Luna green4 browser database: `ecolitea2-final-fix-green4-e2e`, run `final-fix-green4`, `DISABLE_R2_STORAGE=true`. Teardown completed without errors; local `media/` is empty.
- Initial sandbox DB attempt hit local socket EPERM. The identical UUID-isolated test succeeded after approved escalation; it was an environment restriction, not an application regression.

Read installed Next 16 `unstable_cache`, `revalidateTag`, `draftMode`, and `connection` guides (including the stale-while-revalidate semantics of `max`), Payload `findByID` public types, installed Search plugin docs, and installed Lexical Link converter before implementation. Read the design, corrections, reference HTML, progress ledger, and Task 12 report. Used receiving-code-review and test-driven-development; no subagents spawned by the repair agent. Controller assigned Luna browser verification as requested.

## Remaining risks and limits

- Search index category title/slug snapshots remain historical by design; public Search presentation resolves current category IDs. Other future consumers of raw snapshots must use that normalization boundary.
- Category invalidation retains existing `revalidateTag(..., 'max')` stale-while-revalidate behavior. The missing subscription is fixed; this change does not promise blocking category freshness on the first request.
- Local media file-route HTTP 500 and duplicate raw redirect Location headers are pre-existing limitations documented in Task 12. UI tests intercept only the fixture PNG; this is not a passing media transport claim. Existing duplicate-header expected-failure tracking remains unchanged.
- Existing missing-email-adapter, Mongoose deprecation, jsdom scrollTo, and webpack file-type warnings are not newly introduced.
- Unrelated `.claude/`, `.playwright-cli/`, and `output/` remain untouched. Test output/media are not staged.

## Follow-up: redirect Full Route Cache

The first GREEN browser run found a second cache layer absent from the component unit harness. The actual generated `.next-e2e/standalone/.next-e2e/server/app/blogs/old-e2e-blog-redirect-final-fix-green.meta` contained status 308, the original Location, and route/redirect tags only. The new stable-ID query therefore never ran on the second request. Reading `draftMode().isEnabled` did not disable this static fallback route in the installed Next version.

After reading installed `connection` documentation, added `await connection()` only in the matching Blog redirect branch. RED unit assertion confirmed the missing request boundary (0 calls instead of 2); GREEN focused redirect/detail/revalidation tests and TypeScript results are recorded in `/tmp/final-fix-route-cache-green.log` and `/tmp/final-fix-tsc2.log`. E2E Location assertion now prints actual values on failure. This experiment passed unit checks but was superseded by the tag invalidation solution below after real browser verification.

After the usage-limit interruption, a fresh focused run at 10:47 passed 25 tests across redirect, detail, search, and listing; TypeScript also passed (`/tmp/final-fix-final-focused.log`, `/tmp/final-fix-final-tsc.log`). The interrupted green2 E2E never reached tests: `.next-e2e/diagnostics/build-diagnostics.json` remained at compile with mtime 01:56:26, no BUILD_ID/server directory, and no listeners on ports 3001/9001. The green2 local PNG belonged to that prebuild fixture and was left for Luna's coordinated cleanup. This is an incomplete verification attempt, not an application test failure.

The green3 browser run demonstrated that conditional `connection()` was incompatible with the route's pre-generated static fallback: the first redirect returned HTTP 500 with `DYNAMIC_SERVER_USAGE`, and the three serial successors did not run. The request-boundary experiment was removed. The final solution retains the route's static rendering and uses the existing Full Route Cache dependency on the `redirects` data tag. Blog hooks call `revalidateTag('redirects', { expire: 0 })` only on slug/publication-state/date changes and published deletion; ordinary content edits leave that tag alone. Because the current redirect query caches the collection together, targeted invalidation is limited to these target-changing events rather than introducing a second redirect cache architecture.

The final E2E warm-cache rename now uses an isolated editor login and normal `/api/blogs/:id` PATCH, then reads the alias anonymously. The test no longer disables the application invalidation mechanism under test. Hook RED: two tests failed for absent immediate redirect invalidation. Hook/component GREEN: 25 tests passed, TypeScript and targeted lint passed (`/tmp/final-fix-invalidation-{red,green}.log`, `/tmp/final-fix-tsc3.log`, `/tmp/final-fix-lint3.log`). Luna green4 passed all four tests. Initial Location was `/blogs/e2e-blog-redirect-final-fix-green4`; after Admin PATCH it was `/blogs/e2e-blog-redirect-final-fix-green4-renamed`, and the target returned 200. Category search links updated after rename and disappeared after deletion. Green2 and green3 fixture cleanup was verified by Luna, including the interrupted green2 PNG.

Final self-review: inspected the complete diff and `git diff --check` passed. The final Playwright `.last-run.json` reports passed. No test/media output is staged. No unresolved Important or Critical finding remains from this repair scope.
