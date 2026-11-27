# Payload Jobs and external translations: feasibility spike

Date: 2026-11-15. Branch: `spike/payload-jobs`, based on `feature/i18n-consent`. **Report and disposable reproduction code only; this branch is not for merging.** No application config, schema, generated Payload artifacts, dependencies, or lockfile was changed.

## Verdicts

| Question | Verdict |
| --- | --- |
| 1. Hook → task → in-process `autoRun` | **Works on installed canary.** Explicitly initialize with `cron: true`; gate `autoRun` on one designated process. Retries and per-key concurrency exist. This is not distributed leader election or exactly-once execution. |
| 2. Detect publication with autosave | **Works.** On the complete afterChange document, `doc._status === 'published'` detects both first publication and edits to published content. Do not require a status transition. Recover status/version if a write projection omitted them. |
| 3. Prevent loops / context | **Works with explicit scope.** Different collection writes do not invoke source collection hooks. Context is merged into and mutates a reused request; it is not persisted through the queue. Reapply the marker in the task. |
| 4. Unpublish/delete | **Works.** Compare actual public state before/after for unpublish; a draft version alone is not unpublish. Use `afterDelete` for removal, regardless of the latest version's status. |
| 5. One search record per source × locale | **Stock `beforeSync`: no. Custom collection: yes.** Stock sync treats additional same-source rows as duplicates and deletes them. Keep stock English search and own a separate translated index. |
| 6. External merge at read boundary | **Feasible.** Merge allowlisted fields before presentation normalization; explicitly translate populated related entities and partition caches by locale. Plain background jobs cannot assume Next cache invalidation request storage exists. |

## Environment, scope, and reproduction

- Installed versions inspected: `payload`, `@payloadcms/db-mongodb`, `@payloadcms/plugin-search`, `@payloadcms/next`, and the other declared Payload packages are `4.0.0-canary.29`. Next is `16.3.3`; React is `19.2.6`. Node `v24.20.0`, pnpm `9.15.4`.
- The worktree initially had no `node_modules`; installed with `corepack pnpm install --frozen-lockfile`. The sandbox attempt could not resolve the registry (`ENOTFOUND`); the approved installation completed with `Packages: +850` / `Done in 13.7s`. No lockfile change.
- Exact database: **`mongodb://127.0.0.1:27017/ecolitea2-test-spike-jobs`**. Validated by `tests/helpers/isolatedDatabase.ts`. The suite drops only that database and closes its connections in `afterAll`, using the existing project's Mongoose cleanup pattern.
- **`DISABLE_R2_STORAGE=true`**. The harness does not import the application's storage plugins. No uploads, remote storage, production data, Google/provider APIs, or outbound translation requests. Translation is `[fr] ${title}` after a short local delay.
- No HTTP server was started; ports 3000 and 3101 were unused by this spike. Port 3102 remains reserved if a later server check is needed. No files in the main checkout were touched.
- The small collection reproduces Products' exact drafts options (`autosave.interval: 100`, `schedulePublish: true`) with only a title and relationship. It uses real Payload, real Jobs, the installed search plugin, and MongoDB. It does not validate all Products business hooks or a deployed Next container.

Runnable artifacts:

1. `tests/helpers/payloadJobsSpike.ts`: standalone config factory, source and translation collections, source hooks, task, stub provider, and allowlisted merge.
2. `tests/int/payload-jobs-spike.int.spec.ts`: integration scenarios, including real one-second `autoRun` ticks, native `schedulePublish` jobs, and real search cleanup.

The casts around spike collection/task slugs deliberately isolate the reproduction from the application's generated type registry. A real plugin must regenerate types and the Admin import map normally.

Run from this worktree:

```sh
DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-spike-jobs corepack pnpm test:int tests/int/payload-jobs-spike.int.spec.ts
```

The first sandboxed DB run failed before executing scenarios with `connect EPERM 127.0.0.1:27017`. This was a sandbox networking failure, not unavailable MongoDB or an application regression. Approved runs connected successfully. During harness development, one assertion initially assumed a released same-key successor ran in the same batch; installed source showed it is returned to pending, so the assertion now runs another batch. Cleanup was corrected to the installed Mongoose `connection.dropDatabase()` API.

## 1. Jobs config, scheduling, retry, and concurrency

The complete executable task is in `tests/helpers/payloadJobsSpike.ts:36`, and its Jobs configuration is at `:206`. Its exact installed-version shape is:

```ts
const task: TaskConfig<{
  input: { docId: string; sourceVersion: string; fail?: boolean }
  output: { skipped: boolean }
}> = {
  slug: 'translateSpike',
  inputSchema: [
    { name: 'docId', type: 'text', required: true },
    { name: 'sourceVersion', type: 'text', required: true },
    { name: 'fail', type: 'checkbox' },
  ],
  outputSchema: [{ name: 'skipped', type: 'checkbox' }],
  retries: { attempts: 2, backoff: { type: 'exponential', delay: 25 } },
  concurrency: {
    key: ({ input }) => `spike-sources:${input.docId}`,
    supersedes: false,
  },
  handler: async ({ input, req }) => {
    // Full read / stub / translation write is in the runnable harness.
    const doc = await req.payload.findByID({
      collection: 'spike-sources', id: input.docId, draft: false, depth: 0,
    })
    return { output: { skipped: doc.updatedAt !== input.sourceVersion } }
  },
}
```

This is a shape excerpt; the executable harness contains the custom schemas and task body. The app's generated registry does not yet contain these spike names. In a future plugin, retain `jobs.access.run` from `src/payload.config.ts:119`, append the task, and configure the runner as follows (the environment variable is a proposal, not existing app configuration):

```ts
jobs: {
  // Keep the existing CRON_SECRET / authenticated-user access.run function.
  tasks: [task],
  deleteJobOnComplete: false,
  autoRun: process.env.PAYLOAD_JOBS_RUNNER === 'true'
    ? [{ cron: '*/5 * * * * *', allQueues: true, limit: 1 }]
    : [],
}
```

At process startup, initialize the same application instance with **`getPayload({ config, cron: true })`**. `autoRun` alone does not start timers on a plain Local API initialization. The test observes zero crons before that option and one afterward. Payload REST request initialization also passes `cron: true`, but a public site using only `getPayload({ config })` should not rely on an eventual Admin/API visit to start processing. Production startup wiring needs its own deployment check.

Use `allQueues: true` or also run the `default` queue: native scheduled publication uses `schedulePublish`, normally queued in `default`; running only the custom translation queue would leave it waiting. The tested interval is one second for speed; production can use five seconds or the one-minute default. `autoRun` runs queued jobs and can handle task schedules; it does not automatically create a translation job for each document. Source hooks do that:

```ts
await req.payload.jobs.queue({
  task: 'translateSpike',
  queue: 'translations-spike',
  input: { docId: doc.id, sourceVersion: doc.updatedAt },
  req,
})
```

Await enqueue and pass the hook's `req` to preserve the transaction association. Queue persistence is awaited; provider work is deferred. The job API stores `input`, queue, task/workflow, optional metadata and timing, not the request context. Local Jobs calls default to overriding access; HTTP run access is independently checked. The existing CRON_SECRET endpoint remains usable. The test exercises denied and accepted Local API calls with `overrideAccess: false`; it does not start an HTTP endpoint.

Retry behavior:

- `retries: 2` or `{ attempts: 2 }` means **initial execution + two retries**, not two total executions. The test observes `totalTried` 1, 2, 3; only the third failure has terminal `hasError: true`, and a fourth run does not call the provider.
- Exponential backoff uses `delay * 2 ** totalTriedBeforeThisFailure`, giving 25ms and 50ms in this reproduction. It writes `waitUntil`; later cron ticks pick eligible jobs up. There is no inline sleep/retry loop, and tick frequency adds latency.
- An exception triggers retry. Returning a successful `{ output }` after merely recording a provider error completes the job. `onFail` runs on each failure, before final-retry determination; do not assume it means exhaustion. Preserve previous successful translation fields separately from failure metadata.

Concurrency and operational ownership:

- `limit` is a batch size. Different-key tasks in the batch run with `Promise.all` by default. `payload.jobs.run({ sequential: true })` exists, but `sequential` is not an `autoRun` cron option. One runner, one cron, and `limit: 1` are the simplest conservative initial configuration.
- A concurrency key prevents same-key execution inside a batch and filters keys already running. A duplicate is released to pending for a later batch. Tests observe two parallel executions for two distinct keys, followed by the remaining same-key job on the next run.
- Mongo's Jobs adapter has atomic job claims, unlike assumptions one might make from the general `updateMany` adapter. Concurrent `limit: 1` runner calls executed a single queued job once. Batch claims preserve the original eligibility predicate and retrieve only the winning `processingToken`.
- **Per-key concurrency is not an atomic distributed lock across separate jobs.** Reading currently running keys and then claiming jobs are separate operations. Two runners can both observe no running key and claim different jobs with that key. This is a source-based race assessment; this spike did not force that interleaving.
- The installed `ConcurrencyConfig` type exposes `exclusive?: boolean`, but queue/run implementation does not consume `exclusive`; do not rely on `exclusive: false`. `supersedes: true` deletes older noncompleted jobs without a processing lease before enqueueing the replacement. It does not cancel running work and does not replace a source-version guard. The harness leaves it false to observe both generations.
- Claims expire after a default 20-minute lease, renewed at roughly one third of that duration; a default 30-second safety buffer protects updates. Job updates verify ownership token and lease. A crash or lease loss can still repeat external side effects: make provider accounting and translation writes idempotent.
- Set `PAYLOAD_JOBS_RUNNER=true` on exactly one **Node process**, not merely one container if it runs multiple processes. Other processes use `autoRun: []`. Cron `protect: true` prevents overlap only for that cron object. There is no built-in elected leader or global runner-count setting. Manual/API runs and rolling-deploy overlap can introduce another runner.
- Do not use `shouldAutoRun: () => false` as a temporary polling pause: in this canary it stops that cron object. Prefer the config/env gate. Jobs schedules are handled before this callback is checked.

Installed evidence:

| Owner | File:line |
| --- | --- |
| Task input/output, handler, retries | `node_modules/payload/dist/queues/config/types/taskTypes.d.ts:86`, `:140` |
| Cron options / Jobs config | `node_modules/payload/dist/queues/config/types/index.d.ts:8`, `:118` |
| Concurrency type | `node_modules/payload/dist/queues/config/types/workflowTypes.d.ts:54` |
| Cron creation, guard, protect | `node_modules/payload/dist/index.js:239` |
| `cron` default false / initialization | `node_modules/payload/dist/config/types.d.ts:225`; `node_modules/payload/dist/index.js:461`, `:614` |
| REST bootstrap | `node_modules/payload/dist/utilities/createPayloadRequest.js:12` |
| Queue persistence / supersedes / Local API access | `node_modules/payload/dist/queues/localAPI.js:14`, `:41`, `:79`, `:136` |
| Retry terminal state / backoff | `node_modules/payload/dist/queues/errors/handleTaskError.js:8`, `:54`, `:81`; `node_modules/payload/dist/queues/errors/calculateBackoffWaitUntil.js:3` |
| Eligibility, key filtering, batch release, parallelism | `node_modules/payload/dist/queues/operations/runJobs/index.js:26`, `:88`, `:203`, `:423` |
| Mongo job claims | `node_modules/@payloadcms/db-mongodb/dist/updateJobs.js:97`, `:115`, `:131` |
| Lease defaults / heartbeat / ownership | `node_modules/payload/dist/config/defaults.js:64`; `node_modules/payload/dist/queues/operations/runJobs/heartbeat.js:3`; `node_modules/payload/dist/queues/operations/runJobs/runJob/getUpdateJobFunction.js:10` |
| Manual run endpoint/access | `node_modules/payload/dist/queues/endpoints/run.js:7` |

## 2. Exact publication condition

For this **nonlocalized, drafts-enabled** configuration, the condition on a complete afterChange document is:

```ts
const shouldQueueTranslation =
  !req.context.translationWrite && changedDoc._status === 'published'
```

Here `changedDoc` is the complete document returned to the hook, or the latest just-written version recovered when `select` omitted lifecycle fields. The harness recovery uses `findByID({ collection, id: doc.id, draft: true, depth: 0, req })`. Use the same transaction/request, and prefer complete write responses for lifecycle consumers. Enqueue from the recovered snapshot's `updatedAt`, not a projected/absent timestamp. Re-reading outside the transaction while concurrent writers operate can observe a subsequent version; production must reject stale generations at execution/commit too.

Do **not** add `previousDoc._status !== 'published'`: publishing another revision of already-published content must also translate. Do not use `publishedAt` changes or `req.query.draft` as publication signals. Local API draft arguments are not copied into `req.query`.

| Operation tested | Effective hook status | Translation job |
| --- | --- | --- |
| Create draft | draft | No |
| `draft:true, autosave:true`, title-only write | draft | No |
| Draft → `_status:'published'` | published | Yes |
| Title update on a published document | published | Yes |
| New draft over an existing published document | draft | No |
| Publish that newer draft with `draft:true, _status:'published'` | published | Yes |
| Update with `draft:true, autosave:true, _status:'published'` | published | **Yes: this really publishes** |
| Native scheduled publish job becomes eligible | published | Yes |
| Publish with `select:{title:true}` | Hook response omits status; recovered version is published | Yes |

Installed update logic computes `isSavingDraft = draftArg && hasDraftsEnabled(...) && data._status !== 'published' && !publishAllLocales`. Thus an explicit publish update overrides `draft:true`; a blanket `!autosave` guard would miss a real publish. Create differs: `draft:true` forces draft even if supplied data says published.

`afterChange` has `doc`, `previousDoc`, `data`, `operation`, `context`, `req`, and optional `overrideAccess`; there is no `autosave`/`draft` hook argument. Write projections are applied in `afterRead` before collection `afterChange`; a bare `doc._status` test without complete data is insufficient for every Local API caller.

Installed evidence: `node_modules/payload/dist/collections/config/types.d.ts:108`; `node_modules/payload/dist/collections/operations/utilities/update.js:27`, `:230`, `:262`, `:279`, `:323`; `node_modules/payload/dist/collections/operations/create.js:45`; `node_modules/payload/dist/utilities/stripUnselectedFields.js:8`. Current Products options: `src/collections/Products/index.ts:208`.

Scheduled publishing uses the injected `schedulePublish` task, which calls ordinary `payload.update` with `_status:'published'` or `'draft'`. It therefore triggers the source hooks. It creates a fresh Local API request rather than passing the runner's `req` or context. Registration is in `node_modules/payload/dist/config/sanitize.js:382`; implementation is `node_modules/payload/dist/versions/schedule/job.js:3`. Even though app config writes `tasks: []`, scheduled collections cause this task to be injected. The test enqueues the actual native task with future `waitUntil`, confirms no early publication, then runs it after eligibility.

## 3. Context and loop prevention

The source hook is attached to `spike-sources` only. A task's `payload.create({ collection:'spike-translations' })` invokes translation hooks, **not** source hooks. No marker is needed to get that basic isolation. Markers protect shared/plugin hooks and any intentional source writes.

```ts
const originalContext = req.context
try {
  await req.payload.create({
    collection: 'spike-translations',
    data: translation,
    req,
    context: { translationWrite: true },
  })
} finally {
  req.context = originalContext
}
```

This is the awaited serial nesting pattern used by the harness; `translation` denotes the record built by the task. The test shows that `{parent:'preserved',translationWrite:false}` becomes `{parent:'preserved',translationWrite:true}` on the supplied request after the nested call. Context is shallowly spread, with explicit `context` overriding `req.context`. Nested object values remain shared. `finally` restoration is necessary even if the nested operation throws.

The hook's `hookOnly` marker is absent from later autoRun task context: the queue does not serialize it. Set `translationWrite` in the task's own Local API operations. Also do not expect setting context on a native scheduled-publication runner to propagate into the native task's source update.

**Batch caveat:** Jobs isolates `transactionID`, not `context`, when creating each job request proxy. Concurrent jobs can share request context; save/restore around a nested write is not a concurrency isolation mechanism. For concurrent tasks create an independent child Local API request/context per job/write, preserving required user, locale, and transaction data explicitly. The proposed initial `limit:1` avoids this complication. Never treat a request context flag as an authorization check.

Installed evidence: `node_modules/payload/dist/utilities/createLocalReq.js:4`, `:86`; `node_modules/payload/dist/collections/operations/local/update.js:17`; `node_modules/payload/dist/queues/localAPI.js:41`, `:136`; `node_modules/payload/dist/queues/operations/runJobs/index.js:282`; `node_modules/payload/dist/utilities/isolateObjectProperty.js:3`.

## 4. Unpublish and delete

Unpublish cannot be reliably identified by just `previousDoc._status === 'published' && doc._status === 'draft'`. A newer draft can make both values `draft` when a scheduled or direct unpublish removes the public version. Conversely a draft save can return `draft` while the public document remains published.

The minimal generic mechanism tested:

1. In `beforeChange`, read the **public/main** document with `draft:false, depth:0, req`, recording whether it is published in a per-ID map on request context. Create has no previous public state.
2. In `afterChange`, if the returned/recovered version is draft and the prior public snapshot was published, read the public/main document again.
3. **Unpublish condition:** `wasPublic && currentPublic?._status !== 'published'`. Draft autosave keeps the main document published and fails this condition.
4. For deletion, invalidate by collection and ID in `afterDelete` unconditionally. Use `beforeDelete` if the old public URL/version is needed; do not depend on the deleted/latest version's status.

The harness implements this in `tests/helpers/payloadJobsSpike.ts:101`. It reports both lifecycle events but deliberately does not implement a production translation invalidation subsystem. The scheduled test verifies `previousStatus:'draft', status:'draft'` still records unpublish. It also deletes a published source with a newer draft; its queued jobs observe the missing source and skip translation.

Products already owns a stronger application-specific public transition mechanism in `src/collections/Products/hooks/productPublicTransition.ts:24`, `:61`, `:89`, wired through its beforeOperation/beforeChange/beforeDelete hooks. It captures Local API draft intent and avoids public reads for draft-only writes. Integrate with that owner carefully: its final consumer clears state, so a later appended translation hook must not assume the snapshot survives. Avoid replacing it with previousDoc-only logic. The generic spike intentionally uses a separate snapshot and extra reads for clarity.

Production invalidation must cover translation readiness, translated search rows, sitemap/hreflang, and caches for all locales. A worker should recheck current source status/version before committing its result, and readers should still verify the source is publicly visible. Deletion/unpublish can occur during a provider request. Future-dated `publishedAt` is a separate public visibility rule in this app; it is not a Payload publish event. Keep date visibility filtering for reads and search.

Installed delete hook evidence: `node_modules/payload/dist/collections/operations/deleteByID.js:44`, `:198`; draft-only main-write behavior: `node_modules/payload/dist/collections/operations/utilities/update.js:230`. Restoring versions also invokes beforeChange/afterChange as an update (`node_modules/payload/dist/collections/operations/restoreVersion.js:169`, `:288`); restoration paths were inspected, not exercised by this spike's new suite. Trash, if enabled later, is a separate update lifecycle that needs explicit visibility handling.

## 5. Search ownership without native localization

`beforeSync` returns **one `DocToSync`**, not an array. Adding a `contentLocale` field changes row data, not plugin identity. On source update the plugin queries only `doc.relationTo` and `doc.value`, chooses the first result, and deletes the rest as duplicates. The integration test creates English + French rows for the same source and observes **2 → 1** after updating that source. Stock deletion also removes matching source rows, and stock reindex follows the same sync utility.

`localize:true` means localized Payload fields; it does not create an external locale dimension when Payload localization is disabled. A `beforeSync` side effect that creates more rows fights the normal updater/reindexer. Do not depend on plugin internals or fake source IDs to evade deduplication.

Recommended approach: retain stock `search` for English; create a plugin-owned `translation-search` collection for other locales. Translation completion/invalidation owns its writes through Local API. Query the appropriate collection explicitly by validated locale, ready state, source version, and public source visibility. A real schema can use the public compound index API:

```ts
const translationSearch: CollectionConfig = {
  slug: 'translation-search',
  access: { create: () => false, update: () => false, delete: () => false, read: () => false },
  indexes: [{ fields: ['sourceCollection', 'sourceId', 'locale'], unique: true }],
  fields: [
    { name: 'sourceCollection', type: 'text', required: true },
    { name: 'sourceId', type: 'text', required: true },
    { name: 'locale', type: 'text', required: true },
    { name: 'sourceVersion', type: 'text', required: true },
    { name: 'title', type: 'text', required: true },
    { name: 'excerpt', type: 'textarea' },
    { name: 'path', type: 'text', required: true },
    { name: 'ready', type: 'checkbox', defaultValue: false },
  ],
}
```

This is a recommended schema shape, not a fully tested search implementation. Keeping reads closed allows a server-owned search utility to enforce visibility before returning results. A public read-access predicate is another option if it can enforce the full visibility contract. Privileged writes must be server-only; Local API overrides access by default. Add uniqueness, idempotent update/create with duplicate-key handling, and a rebuild command owned by the translation plugin. Preserve the app's `publishedAt` filter for Products/Blogs. Changing stock sync to `skipSync` for selected sources would require owning all corresponding create/update/delete/reindex behavior; it offers little benefit over a separate collection here.

Installed evidence: `node_modules/@payloadcms/plugin-search/dist/types.d.ts:12`; `node_modules/@payloadcms/plugin-search/dist/utilities/syncDocAsSearchIndex.js:26`, `:64`, `:98`, `:117`; `node_modules/@payloadcms/plugin-search/dist/Search/hooks/deleteFromSearch.js:1`; `node_modules/@payloadcms/plugin-search/dist/index.js:8`; compound indexes: `node_modules/payload/dist/collections/config/types.d.ts:542`. Existing app integration: `src/plugins/index.ts` and `src/search/beforeSync.ts`; date visibility: `src/search/visibility.ts`.

## 6. Data-access merge, population, and caching

Prefer an explicit data-access wrapper over a universal collection `afterRead` translator. The wrapper owns locale selection, source visibility, translation lookup, merge, and presentation normalization; Payload's stored English documents stay provider-neutral. Do not pass external locale identifiers to Payload's native `locale` API expecting translation when localization is disabled.

Recommended read flow:

1. Resolve current slug to stable source ID using the existing public visibility predicate.
2. Read published English data with explicit `depth` / `populate` / access options. Read the external translation by collection + ID + validated locale, including source version and readiness.
3. Clone and apply only allowlisted display fields to the source snapshot. Do not spread an arbitrary JSON translation over the document. Preserve IDs, slugs, URLs, media metadata, relationships, layout and numeric specifications. Apply array/block paths using stable row IDs and source-version checks, not stale numeric offsets.
4. Resolve translations for populated related categories, media alt text, documents and other display entities explicitly, preferably batching lookups by collection/ID. A parent translation does not translate the populated objects automatically. Leave missing/unpopulated relationships as IDs; never invent objects.
5. Normalize into existing presentation models **after merging**. Products' normalization derives overview paragraphs, metadata, categories and download labels; merging the raw translation afterward misses those derived values.

The test reads the same source with `depth:0` (related ID) and `depth:1` (related object), merges the parent's French title without mutating the English source, and demonstrates that the related title remains English. It also refuses a stale-version row. Production rules must deliberately handle related entity translations and choose fallback behavior.

Payload population passes depth, select/populate, locale, access, and transaction into its dataloader. An inaccessible or unpopulated relationship can remain an ID. `populate` limits selected fields; an overlay cannot rely on source fields omitted by the query. Read enough fields for translation/version checks even if the eventual presentation model is smaller. Local API defaults to overriding access, so maintain the existing `overrideAccess:false, draft:false` public contract, and do not expose admin-only translation error data.

Installed evidence: `node_modules/payload/dist/fields/hooks/afterRead/relationshipPopulationPromise.js:23`, `:28`, `:47`. Existing readers: `src/utilities/getGlobals.ts:9`, `:25`; `src/utilities/products/getProductBySlug.ts:36`, `:52`, `:65`; normalization: `src/utilities/products/shared.ts:111`.

### Cache keys and tags

Current Globals cache identity is `[slug, depth]` with tag `global_${slug}`. Product detail cache identity is `['product-detail-v2', id]`, with `product-${id}`, `products-list`, and `product-categories` tags. These are safe for the current single-language data but **would leak the first cached language across locales if a locale-dependent merge were placed inside unchanged closures**.

Two sound ownership choices:

- Keep the existing English caches; separately cache each translation by `[collection, id, locale, sourceVersion, ruleVersion]`; merge cloned values outside the source cache.
- Cache the final merged model with an explicit locale and relevant depth/population/rule version in its key, e.g. `['product-detail-i18n-v1', id, locale, 'depth-2']`. Add source and translation dependency tags. Partition Globals similarly, e.g. `['global-i18n-v1', slug, String(depth), locale]`.

Tags invalidate entries but **do not partition cache identity**. Adding `translation:products:${id}:fr` to tags while keeping the same key is insufficient. A missing/not-ready translation is also a cached fallback; invalidate it when translation becomes ready. On translation completion invalidate its document/locale tag and relevant merged Global/product/list/search dependencies. Related entity completion must invalidate parents that display that entity; use dependency tags or the existing broad category/product tags until a more precise owner is needed. On unpublish/delete invalidate all locale variants and keep the uncached slug/visibility check that already protects the public detail entry point.

Choose stale translation display deliberately. The harness requires matching `sourceVersion`, so a failed retranslation falls back to English even if an old translation was retained. If the product wants to display the old translation on failure, distinguish `lastReadySourceVersion` from `requestedSourceVersion` and never label old fields as translated from the new source. `updatedAt` is sufficient for this reproduction, but a production source generation should cover the allowlisted content/rule version and account for related content dependencies. Checking only at task start does not protect against an unpublish/new publish while the provider is running; recheck before writing and enforce idempotent generation ownership.

Preview must remain authenticated and uncached, as it is today. Resolve headers/cookies outside a cached scope and pass validated locale as an explicit argument. Do not capture request auth/context in a shared public cache.

### Background invalidation needs a Next boundary

The integration suite imports real `next/cache` and calls `revalidateTag` from plain worker code. It throws **`Invariant: static generation store missing`**. Installed Next requires a work store with an incremental cache. An in-process cron is not a reliable replacement for a Route Handler/Server Function; do not rely on async request context accidentally inherited when a timer was created.

Use an authenticated, server-only Next Route Handler for immediate invalidation, invoked after durable translation completion; make notification retryable/idempotent. This is a recommended integration boundary, not an endpoint built or tested by this spike. TTL-only invalidation is possible if explicitly acceptable, but Globals currently cache indefinitely and need a deliberate policy. Use `{ expire:0 }` where removed content must not be served stale; existing `'max'` is stale-while-revalidate.

This also matters for scheduled Products publication: existing `revalidateProduct` directly calls Next invalidation, and native `schedulePublish` calls `payload.update` without passing the runner request/context. The minimal collection proves the Payload lifecycle, **not** that the application's current revalidation hooks are safe in a cold background process. Resolve this boundary and run a real container check before production implementation.

Installed guides read: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md:6`, `:27`, `:38`; `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/revalidateTag.md:12`, `:20`. Runtime guard: `node_modules/next/dist/server/web/spec-extension/revalidate.js:107`. Next 16's installed guide recommends `use cache` over `unstable_cache`; migrating the existing cache architecture is separate work, not required for this feasibility result.

## Verification record and limits

Final command evidence:

```text
DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test-spike-jobs corepack pnpm test:int tests/int/payload-jobs-spike.int.spec.ts
SPIKE target=mongodb://127.0.0.1:27017/ecolitea2-test-spike-jobs; R2 disabled; translation provider=stub; no HTTP server
Test Files  1 passed (1)
     Tests  13 passed (13)
  Start at  14:24:21
  Duration  6.10s (transform 85ms, setup 47ms, import 867ms, tests 5.04s, environment 0ms)
```

The suite covers publication/draft/autosave, write projections, actual autoRun, missing queued context, retry exhaustion, disabled runner configuration, access.run, concurrent Mongo claims, same-key and different-key execution, cross-collection hooks/context mutation, native scheduled publish/unpublish/delete, stale source generations, stock search deduplication, relationship population/merge, and the Next invalidation guard.

Additional checks:

- `corepack pnpm exec eslint tests/helpers/payloadJobsSpike.ts tests/int/payload-jobs-spike.int.spec.ts`: exit 0.
- `corepack pnpm exec tsc --noEmit --incremental false`: **exit 2**, only four existing errors in `tests/int/website-shell.int.spec.tsx:74`, `:124`, `:135`, `:143`: required `gtmDisabled` prop is missing. No spike-file errors in the final check.
- `corepack pnpm lint`: **exit 1**, 2 existing errors / 10 warnings. Errors: `src/consent/ConsentProvider.tsx:38` (`react-hooks/set-state-in-effect`) and `src/consent/gtm.ts:26` (`prefer-rest-params`). Left unrelated files unchanged.
- Runtime emitted installed Mongoose deprecation warnings about `new` versus `returnDocument:'after'`; no email adapter is configured in the harness. Neither prevented integration execution.
- No application build, browser E2E, Google API, live storage, quota system, full translation rules, atomic translation upsert, real locale routing, custom search rebuild, crash recovery, forced multi-process same-key race, or deployed Next cache invalidation check was performed. These remain implementation/operational validation, not evidence against basic Jobs feasibility.

Final integration exit code: **0**, including isolated database cleanup. Assertions and observations are in `tests/int/payload-jobs-spike.int.spec.ts:51`, `:106`, `:139`, `:162`, `:183`, `:203`, `:218`, `:238`, `:262`, `:305`, `:320`, `:341`, and `:377`.

## Official references checked

The [Payload Beta Jobs overview](https://payloadcms.com/docs/beta/jobs-queue/overview), [Beta drafts documentation](https://payloadcms.com/docs/beta/versions/drafts), and [Beta search plugin documentation](https://payloadcms.com/docs/beta/plugins/search) were consulted. Installed canary source/types and the integration results above are authoritative for this report. In particular, public type availability does not establish that `exclusive:false` is implemented, and broad autoRun descriptions do not remove the installed `cron:true` initialization requirement.
