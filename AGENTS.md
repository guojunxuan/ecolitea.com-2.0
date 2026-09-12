<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Payload application conventions

## Application architecture

This repository is a Payload CMS application. Payload owns the content model,
Admin UI, access control, hooks, and application data APIs. Next.js hosts both
Payload and the public website, MongoDB is the configured database adapter, and
uploaded files use a configurable storage adapter. Application features should
be implemented through these boundaries rather than around them.

Treat `package.json` and the lockfile as the source of truth for versions. The
project currently uses Next.js 16, React 19, Payload 4 canary, TypeScript,
Tailwind CSS, MongoDB 7, and pnpm. Do not assume APIs from older stable releases
are compatible with the installed versions.

## Technical documentation

- Organize technical documentation around the Payload application architecture:
  content models, extension points, data flow, frontend consumption, and
  operational boundaries. Business requirements should be mapped onto those
  technical owners explicitly.
- Treat Next.js, database, and storage providers as integrations around the
  Payload core. Link to upstream documentation for general product setup instead
  of reproducing vendor manuals in this repository.
- Read the relevant installed Next.js guide before changing Next.js routes,
  rendering, caching, images, configuration, or build behavior.
- Before changing Payload configuration or Admin behavior, inspect the installed
  Payload types, package documentation, and existing project patterns.
- Keep `payload` and all `@payloadcms/*` packages on compatible versions. Do not
  upgrade or downgrade one Payload package in isolation.
- Use `README.md` for application setup and common commands. Use `docs/` for
  architecture, feature designs, implementation plans, and deployment details.
  Keep this file focused on durable Payload application conventions.

## Sources of truth

- Use `package.json` and `pnpm-lock.yaml` for dependency and runtime versions.
- Use the Payload collection, Global, field, and plugin configs under `src/` for
  the persisted content model. `src/payload-types.ts` is generated from them.
- Use `src/utilities/env.ts` for the runtime environment contract and
  `.env.example` for the documented configuration surface.
- Use existing implementation and tests for current behavior. Design documents
  record intent and decisions, but verify that later code has not superseded
  them before applying an older plan.
- When sources disagree, identify the mismatch explicitly. Do not silently make
  code conform to stale generated files or historical documentation.

## Payload application boundaries

- Prefer configuration over hardcoded business rules.
- Keep interfaces provider-neutral. Storage and delivery provider details belong
  in dedicated adapters, not in business Blocks or page components.
- Follow the existing `src/` structure and place behavior with its current
  owner. Do not introduce a parallel component system, configuration layer, or
  speculative abstraction.
- Give modules a clear owner, input, and output. Extract shared behavior only
  when at least two real consumers need the same contract.
- Treat Payload configuration as the owner of persisted application structure.
  Keep schemas, generated types, adapters, seed data, and frontend consumers
  synchronized when a data shape changes.
- Normalize Payload data at module boundaries. Header, Footer, and Site Settings
  components should consume stable presentation models rather than repeatedly
  interpreting raw relationship values and conditional fields.
- Preserve server and client boundaries. Add `use client` only to the smallest
  component that requires browser state or client-only hooks.

## Payload extension conventions

- Prefer Payload's public configuration APIs, native fields, Globals,
  Collections, Relationships, hooks, access controls, and documented Admin
  component slots.
- Prefer native Admin behavior before creating custom controls. Do not recreate
  a Payload feature solely to make a minor interaction or styling change.
- Do not depend on Payload's private DOM structure, generated CSS class names,
  portal placement, or undocumented component internals. Scope any Admin CSS to
  a project-owned class.
- Put validation that must protect every write on the server. Client-side UI
  constraints may improve feedback but must not be the only integrity check.
- Use native field constraints for requirements they can express. Reserve
  custom cross-field validators for actual cross-field business rules, and do
  not duplicate database uniqueness checks without a documented reason.
- Validation and normalization must not delete inactive or hidden data as a side
  effect.
- Use Payload's data-access APIs for application operations. Avoid direct
  MongoDB access unless the task is an explicit migration or operational repair.
- Treat `src/payload-types.ts` and
  `src/app/(payload)/admin/importMap.js` as generated artifacts. Regenerate them
  with `corepack pnpm generate:types` and
  `corepack pnpm generate:importmap`; do not hand-edit them.

## Payload media and infrastructure adapters

- The Media and Brand Assets collections own upload rules and stored metadata.
  Persist original file URLs; generate derived delivery URLs at render time.
- Keep storage operations behind the Payload storage adapter and delivery logic
  behind the shared media renderer. Business components declare presentation
  needs and must not construct provider-specific URLs.
- Treat infrastructure providers as replaceable implementation details.
  Cloudflare R2 is the current object-storage provider; provider-specific setup
  and transformation behavior belongs in architecture documentation and the
  owning adapter, not in business-domain code or this guide.
- Use isolated storage, credentials, domains, and database content for each
  environment. Runtime configuration is read from environment variables; never
  hardcode infrastructure identifiers, domains, or secrets.
- Automated tests must use isolated placeholders or local storage and must never
  contact production services. Use `DISABLE_R2_STORAGE=true` when storage
  integration is outside the test scope.

## Data and environment safety

- Never commit `.env` files, credentials, secrets, production database values,
  or R2 access keys.
- Before any seed, cleanup, migration, or destructive data operation, resolve
  and report the exact database and storage environment being targeted.
- Development cleanup must be narrowly scoped and deterministic. If content is
  still referenced, report the references and refuse deletion rather than
  rewriting unrelated collections implicitly.
- Do not change production infrastructure, production content, or remote storage
  as part of ordinary application development.

## Testing and verification

- Use the smallest relevant test first, then expand verification in proportion
  to the change.
- Integration and end-to-end tests require MongoDB. Do not describe a database
  connection failure as an application regression without separating the two.
- Use the project commands:

  ```bash
  corepack pnpm test:int
  corepack pnpm test:e2e
  corepack pnpm exec tsc --noEmit --incremental false
  corepack pnpm lint
  corepack pnpm build
  ```

- Schema changes should include schema or validation coverage and regenerated
  Payload artifacts. Adapter changes should have focused pure tests. Responsive
  or interactive UI changes should include component coverage and targeted
  browser verification.
- Do not commit Playwright output, temporary database files, generated test
  artifacts, or local browser automation state.

## Change discipline

- Inspect Git status before editing. Preserve unrelated staged, modified, and
  untracked user work.
- Limit changes to the requested feature and its required consumers, generated
  artifacts, tests, and documentation. Report unrelated findings instead of
  fixing them opportunistically.
- Preserve existing naming, path aliases, formatting, and test organization.
- Do not edit lockfiles unless dependencies intentionally change.
- Do not claim a change is complete when required validation was skipped or
  failed. State exactly what ran and what remains unverified.
