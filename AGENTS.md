<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Ecolitea project conventions

## Project context

Ecolitea is a self-hosted website and content-management application. Next.js
serves both the public website and Payload Admin, MongoDB stores application
content, and Cloudflare R2 stores uploaded media.

Treat `package.json` and the lockfile as the source of truth for versions. The
project currently uses Next.js 16, React 19, Payload 4 canary, TypeScript,
Tailwind CSS, MongoDB 7, and pnpm. Do not assume APIs from older stable releases
are compatible with the installed versions.

## Project documentation

- Organize project documentation around Ecolitea's architecture, business goals,
  domain boundaries, and engineering standards. Frameworks, vendors, and tools
  are supporting implementation details and must not become the document's
  primary narrative.
- Explain why a dependency or infrastructure choice matters to Ecolitea before
  documenting provider-specific behavior. Link to upstream documentation for
  detailed product setup instead of reproducing vendor manuals in this project.
- Read the relevant installed Next.js guide before changing Next.js routes,
  rendering, caching, images, configuration, or build behavior.
- Before changing Payload configuration or Admin behavior, inspect the installed
  Payload types, package documentation, and existing project patterns.
- Keep `payload` and all `@payloadcms/*` packages on compatible versions. Do not
  upgrade or downgrade one Payload package in isolation.
- Use `README.md` for Ecolitea setup and common commands. Use `docs/` for project
  architecture, feature designs, implementation plans, and deployment details.
  Keep this file focused on durable project conventions.

## Architecture

- Prefer configuration over hardcoded business rules.
- Keep interfaces provider-neutral. Infrastructure details such as R2 endpoints
  and Cloudflare transformation syntax belong in a dedicated adapter or media
  renderer, not in business Blocks or page components.
- Follow the existing `src/` structure and place behavior with its current
  owner. Do not introduce a parallel component system, configuration layer, or
  speculative abstraction.
- Give modules a clear owner, input, and output. Extract shared behavior only
  when at least two real consumers need the same contract.
- Keep Payload schemas, generated types, adapters, seed data, and frontend
  consumers synchronized when a data shape changes.
- Normalize Payload data at module boundaries. Header, Footer, and Site Settings
  components should consume stable presentation models rather than repeatedly
  interpreting raw relationship values and conditional fields.
- Preserve server and client boundaries. Add `use client` only to the smallest
  component that requires browser state or client-only hooks.

## Content platform conventions

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

## Infrastructure and media delivery

- Cloudflare is an infrastructure provider, not a business-domain dependency.
  Keep Cloudflare-specific behavior behind provider-neutral storage and media
  interfaces.
- Use separate R2 storage and credentials for development and production. Read
  configuration from environment variables and never hardcode infrastructure
  identifiers, domains, or secrets.
- Treat R2 objects as originals. Payload and MongoDB store original file URLs;
  derived delivery URLs are generated at render time and are not persisted.
- Keep storage operations in the Payload storage adapter and media delivery
  behavior in the shared renderer. Business Blocks declare presentation needs
  and must not construct provider-specific transformation URLs.
- Use Cloudflare Image or Media Transformations where the shared delivery layer
  requires them, while avoiding duplicate image-optimization pipelines.
- Automated tests must use isolated placeholders or local storage and must never
  contact production R2. Use `DISABLE_R2_STORAGE=true` when R2 integration is
  outside the test scope.

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
