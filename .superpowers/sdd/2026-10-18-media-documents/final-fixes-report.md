# Final review fix wave

Base `ddee50b`, branch `feature/media-documents`. Scope: P1 working-draft reference protection and both browser evidence findings in `final-review.md`.

## Change and evidence

- Both independent scanners inspect the union of stored/published content and public `draft: true` reads for draft-enabled collections and Globals. Current owner/target/field locations are deduplicated. Version references remain nonblocking; removing usage from both current representations permits deletion despite older versions. No Media module is imported into Documents.
- Installed Payload collection `find` uses `queryDrafts` (latest versions, including autosave); Global `findGlobal` uses `replaceWithDraftIfAvailable`. Global autosave writes are tested through public REST because installed Local API types do not expose its autosave flag. Public paging, `locale: all`, hidden content, access override, request propagation and collection trash inspection remain; exact native locks/preferences exclusions remain unchanged.
- Real Payload fixtures now enable drafts and autosave. Eight new collection/Global cases (manual draft and autosave, both resources) were RED before implementation: current draft-only reference assertions received `[]`. GREEN verifies latest-draft-only single/bulk/REST deletion blocking, published-only blocking after draft removal, current location deduplication, and historical-only deletion after removal from both states. Four more pure cases cover paginated draft reads and fail-closed collection/Global draft read errors.
- PDF browser evidence now resolves the rendered iframe source, binds its origin/path to the saved document URL, and verifies bytes/content type from that actual source. Batch verification reads saved records and asserts edited/default alt/title by exact filename.
- Existing Documents expected-error logging now forwards unexpected errors; new expected deletion errors remain visible. No global/broad log suppression.

## Verification

- RED focused drafts: 2 files, 8 expected failures / 33 skipped.
- Final focused integrations: `media-references`, `documents-references`, `media-cleanup`, `resource-prefix-migration`: **4 files / 96 passed**, exit 0. Includes real isolated Payload/MongoDB fixtures and local mocked storage; no operational migration invoked.
- Scoped ESLint: exit 0, no warnings/errors for the five changed source/test files.
- Final sequential TypeScript: `corepack pnpm exec tsc --noEmit --incremental false`, exit 0 after the standalone build completed.
- Targeted Chromium: initial clean standalone build (R2 disabled, empty `NODE_PATH`) passed PDF/Office test; batch failed before the new assertions because a native prefilled input stayed disabled. Waiting for the successful second published-access response with `create: true` made Media batch pass saved-value assertions, but Documents still hit disabled initialization. Final diagnostic added a normal native row switch/remount plus an enabled assertion: **batch passed for both resources, 1 test / exit 0 / 55.9s**. PDF/Office passed twice (unchanged by the batch-only synchronization edit). No forced control, arbitrary delay or application permission workaround.
- The two reruns reused the exact unchanged standalone artifact built at `ddee50b` plus this wave's scanner edits. Scanner Git blobs: Media `55fb1c49621620b4c13a1c169e3daabf79373b74`, Documents `833a3127c8f477fcd0f8d3c4bbf1e32e71036905`. Only test synchronization changed afterward. Temporary config imported `playwright.config.ts` and replaced only the second web server command with `node .next-e2e/standalone/server.js`; all environment/isolation settings were retained. Temporary config is removed, not committed.
- No schema changes; generated types/import map remain unchanged. The 480-test suite and full E2E were not rerun.

## Isolation and limits

Integration fixtures use UUID database names derived from explicit `mongodb://127.0.0.1:27017/ecolitea2-test`, print each exact target before writes and drop only that fixture DB afterward. Upload local storage is disabled and no storage plugin is installed in reference fixtures. First sandbox run could not connect to localhost; rerun with scoped local-network approval produced the real RED/GREEN evidence.

Targeted browser command uses `PLAYWRIGHT_E2E_RUN_ID=finalfix-20261018-a7e1`, `DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-finalfix-20261018-a7e1-e2e`, `DISABLE_R2_STORAGE=true`, empty `NODE_PATH`, ports 3037/9037, and only `uploads and previews PDF|prefills both batch` tests. Local uploads use run-specific filenames. Exact targets were reported before each execution. Follow-up test databases used the same prefix with `finalfix-20261018-b8f2` and `finalfix-20261018-c9f3`.

Exact alternate command (final diagnostic; earlier b8f2 rerun used the same command with both test names and no trace):

```bash
PLAYWRIGHT_E2E_RUN_ID=finalfix-20261018-c9f3 DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-finalfix-20261018-c9f3-e2e DISABLE_R2_STORAGE=true NODE_PATH= PLAYWRIGHT_PORT=3037 PLAYWRIGHT_STORAGE_PORT=9037 NODE_OPTIONS='--no-deprecation --import=tsx/esm' corepack pnpm exec playwright test --config=.finalfix-e2e.config.ts tests/e2e/media-documents.e2e.spec.ts --grep 'prefills both batch' --reporter=line --trace=on
```

Native initialization evidence: installed BulkUpload initializes form state and save permissions concurrently; serialized custom fields are returned directly by `RenderFields/RenderField`. This supports a stale initial read-only state as the cause (inference, not an upstream fix claim). Project `AltPrefill`/`TitlePrefill` use public `TextField`, `useField`, `useFormFields`, `useFormInitializing`; no private state is mutated. Waiting for allowed permissions, then normal native row selection and an enabled assertion provides the final browser evidence.

One TypeScript invocation overlapped Next rebuilding generated `.next-e2e/types` and failed with transient TS6053 generated-route-not-found errors; rerunning sequentially after the build completed passed (exit 0). No source/config workaround is appropriate.

No developer/production database, real R2/Cloudflare service, migration, Media version purge, or remote storage mutation occurred. Existing `.claude/`, `.playwright-cli/`, `media/`, `output/`, `public/demos/` work is preserved. Live provider behavior and real environment migration remain outside this fix wave. Installed Mongoose deprecation and Next/color warning output remain visible.

Self-review: production changes are limited to two independent scanners; public APIs preserve Payload boundaries; current dedup keys include owner type/slug/document, target ID and exact path; failures propagate rather than weakening deletion protection. Browser assertions connect persistence and preview evidence to the saved resources.

Cleanup: guarded cleanup completed successfully (exit 0) for all three exact owned local E2E databases after checking connected database names. Temporary startup/cleanup files were removed. The only remaining owned local fixture file found was `.next-e2e/standalone/media/e2e-blogs-finalfix-20261018-a7e1.png`, now removed by its enumerated exact path. Browser output/trace is ignored and excluded from the commit.
