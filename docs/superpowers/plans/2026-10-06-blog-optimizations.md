# Blog Optimizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the six reviewed blog improvements in `docs/optimization/README.md` while preserving Payload ownership, public visibility rules, server-rendered first pages, and accessible pagination.

**Architecture:** Keep cosmetic behavior in existing blog card and layout styles. Add a small client island for the mobile table of contents. For discovery, keep server-rendered first-page content and canonical paginated routes, then add a narrowly scoped read-only public listing endpoint and client controls for progressive loading and filters. Payload remains the only data access layer.

**Tech Stack:** Next.js 16 App Router, React 19, Payload 4, CSS Modules, Vitest, Playwright.

---

## Sources and decisions

- Designs: `docs/optimization/{category-label-enhancement,skip-navigation-links,card-entrance-animation,mobile-toc-drawer,infinite-scroll,quick-filter-panel}.md`.
- Read `AGENTS.md` and installed Next route, page, and caching guides before route edits. Inspect Payload types and existing query patterns before data edits.
- Existing `/api/blogs` is Payload's REST endpoint. Use `/api/public-blog-list` for the new public listing endpoint.
- The detail and listing pages already live inside `main#main-content`; skip targets must be unique and focusable. Keep the canonical `/blogs/page/N` and category pages for SEO and no-JavaScript navigation.
- The optional Tags dimension requires a new collection field and generated types, so implement the required category, author, date, and sort dimensions first. Do not introduce a tags field solely for the optional design extension.
- Avoid using `any`, direct MongoDB access, unsafe unpublished content, or stale example tokens from the design documents.
- Final implementation uses request-time rendering for the four blog listing routes so direct filter URLs produce correct HTML before hydration, including without JavaScript. Explicit Payload data caches retain 600-second caching for public categories, counts, authors, and unfiltered listings.

## Task 1: Category pill styling

**Files:** `src/components/Card/index.module.css`, `src/styles/tokens.css`, `tests/e2e/blogs.e2e.spec.ts`.

- [x] Add an E2E assertion that the category link on a blog card has visible pill padding/background and keyboard focus indication; run that test and observe failure.
- [x] Add semantic category surface/text/hover tokens to default and inverse themes. Use those tokens for `.blogCategory`, with padding, small radius, transition, `:active`, and `:focus-visible` outline. Keep post cards unchanged.
- [x] Rerun the focused E2E test and inspect 390px and desktop widths, including inverse theme if reachable.
- [x] Run TypeScript and lint; commit only task files.

## Task 2: Skip navigation

**Files:** `src/components/SkipLink/index.tsx`, `src/components/SkipLink/index.module.css`, `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/blogs/[slug]/page.tsx`, `src/components/TableOfContents/index.tsx`, `tests/int/blog-detail.int.spec.tsx`, `tests/e2e/blogs.e2e.spec.ts`.

- [x] Add a failing keyboard E2E test: first Tab exposes a `Skip to content` link, Enter focuses `main#main-content`; article TOC link appears only when TOC exists and focuses its own target.
- [x] Create a server-compatible `SkipLink({href, children})` anchor with visually hidden default and visible focus styles. Put the primary link before `Header` in the frontend layout. Add the article-specific TOC link without duplicating the global `main-content` ID.
- [x] Give the TOC wrapper a stable `id` and `tabIndex={-1}`; preserve desktop/mobile semantics. Add focus/scroll offset styling using `--website-anchor-offset`.
- [x] Rerun tests and validate keyboard behavior on article and listing. Commit.

## Task 3: Blog card entrance motion

**Files:** `src/components/CollectionArchive/index.module.css`, `tests/e2e/blogs.e2e.spec.ts`.

- [x] Add a failing browser assertion for animated blog archive items under normal motion and no animation under reduced motion.
- [x] Add 400ms fade/translate entrance to blog items only with bounded stagger delays. Use CSS `@media (prefers-reduced-motion: reduce)` to disable animation. Do not force layout or convert the server archive to a client component.
- [x] Verify paginated and appended cards appear, hover remains functional, and reduced motion is honored. Commit.

## Task 4: Mobile TOC drawer

**Files:** `src/components/TableOfContents/index.tsx`, `src/components/TableOfContents/index.module.css`, `tests/int/blog-toc.int.spec.tsx`, `tests/e2e/blogs.e2e.spec.ts`.

- [x] Replace the current mobile `<details>` expectations with a failing test for an accessible open/close button, dialog naming, Escape dismissal, link selection, focus return, and scroll unlock.
- [x] Make only the TOC interactive island client-side. Retain desktop sticky nav. On mobile, use a dialog/drawer with a backdrop, scroll lock cleanup, focus placement/return, Escape handling, and body links that close before anchor navigation. Render no drawer for an empty TOC.
- [x] Verify at 390px, 768px and desktop, including reduced motion and keyboard focus. Commit.

## Task 5: Public listing query and progressive loading

**Files:** `src/utilities/blogs/getPublicBlogResults.ts`, `src/app/(frontend)/api/public-blog-list/route.ts`, `src/components/BlogExplorer/index.tsx`, `src/components/BlogExplorer/index.module.css`, `src/app/(frontend)/blogs/listing.tsx`, `tests/int/blog-public-list.int.spec.ts`, `tests/e2e/blogs.e2e.spec.ts`.

- [x] Write failing query/route tests for positive bounded page input, `publicBlogVisibility`, `overrideAccess:false`, draft exclusion, narrow select, category scoping, and correct pagination metadata. Add a browser test for page-2 append, loading/error/retry/end states.
- [x] Implement a shared public Payload query that accepts validated pagination and optional filters. Add a read-only route at `/api/public-blog-list` with `GET`, dynamic response, no mutation methods, and safe JSON data.
- [x] Render page one on the server. Mount a client explorer for progressive pages with IntersectionObserver and a visible Load more fallback, append by stable blog ID, and live result/loading announcements. Keep existing Pagination as a no-JS/SEO path and existing category pages intact.
- [x] Verify full results with more than 12 fixture blogs and return navigation. Commit.

## Task 6: Quick filters integrated with loading

**Files:** `src/components/BlogFilterPanel/index.tsx`, `src/components/BlogFilterPanel/index.module.css`, `src/components/BlogExplorer/index.tsx`, `src/utilities/blogs/getPublicBlogResults.ts`, `src/app/(frontend)/blogs/listing.tsx`, `tests/int/blog-public-list.int.spec.ts`, `tests/int/blog-listing-ui.int.spec.tsx`, `tests/e2e/blogs.e2e.spec.ts`.

- [x] Write failing tests for category, multiple authors, preset/custom date range, four sort orders, invalid input rejection, URL restoration, reset, empty state, mobile panel, and combined filter + load-more behavior.
- [x] Build filters as a compact client panel. Category choices should use existing category route/IDs; author choices should derive only from publicly visible blogs and expose public names. Synchronize applied filters with URL query parameters and browser navigation; reset to unfiltered state.
- [x] Apply filter conditions in the shared Payload query, always conjoined with public visibility, and reset pagination when a filter changes. Keep request races from overwriting newer results. Use existing category tabs and their canonical routes.
- [x] Verify desktop/mobile keyboard use, combined filters, pagination, empty/error states, and URL restoration. Commit.

## Final verification and branch completion

- [x] Run focused Vitest suites first, then `corepack pnpm test:int`, `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm lint`, targeted E2E, and `corepack pnpm build`. Report any MongoDB/environment failure separately from code failure.
- [x] Run a final browser pass on listing, category, detail, mobile TOC, reduced motion, filter combination, and progressive loading. Preserve pre-existing untracked `.claude/`, `.playwright-cli/`, and `output/`.
- [x] Request spec and code quality reviews, address findings, then use the finishing-a-development-branch workflow. Do not merge or deploy without the user's instruction.
