# Settings Blog Listing SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let editors manage SEO title, description, and share image for `/blogs` and its pagination in the existing Settings → Blog tab.

**Architecture:** Payload owns `settings.blog.listing.seo` using the installed SEO plugin's field components. A server adapter normalizes optional data, and the existing listing metadata function consumes it only for unfiltered routes. The current Settings cache tag invalidates metadata on saves.

**Tech Stack:** Payload 4 canary, Next.js 16 App Router Metadata API, React 19, TypeScript, Vitest, MongoDB 7, pnpm.

**Source of truth:** `docs/superpowers/specs/2026-10-10-settings-blog-listing-seo-design.md` (commit `6b428d8`).

---

## Preconditions

- [ ] Work on `feature/blogs-collection` in the user-selected checkout. Run `git status --short`; preserve `.claude/`, `.playwright-cli/`, `output/`. Do not merge or push.
- [ ] Read `AGENTS.md`, the spec, `src/Settings/fields/blog.ts`, `src/Settings/hooks/validateSettingsHeroImage.ts`, `src/plugins/index.ts`, `src/app/(frontend)/blogs/listing.tsx`, `src/utilities/getGlobals.ts`, installed SEO plugin fields/types, and `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md` plus the installed caching guide. Do not assume older Next or Payload APIs.
- [ ] Run only focused tests. Never edit `.env` or the lockfile. Regenerate Payload types/import map with project commands. Before database-backed verification, report the exact Mongo host/database and `DISABLE_R2_STORAGE=true`.

## Task 1: Persist Blog listing SEO in Settings

**Modify:** `src/Settings/fields/blog.ts`, `src/Settings/config.ts`, `src/plugins/index.ts`, `tests/int/settings.int.spec.ts`.
**Create:** `src/Settings/hooks/validateSettingsSeoImage.ts`.
**Generate:** `src/payload-types.ts`, `src/app/(payload)/admin/importMap.js`.

- [ ] Extend `settings.int.spec.ts` before implementation. Assert `listing.fields` is `[hero, seo]`; `seo` has plugin UI fields `overview,title,description,image,preview`; title/description use `trimText`; plugin overview/preview paths are `blog.listing.seo.*`; image relation is `media` and `filterOptions.mimeType.in` matches `MEDIA_UPLOAD_POLICY.image.mimeTypes`. Assert the Global's new beforeChange hook rejects `video/mp4` on explicit and partial writes, accepts a stored `image/png`, and permits `null` clearing. Assert `generateTitle`, `generateDescription`, `generateURL` return `Blogs`, the current default listing description, and absolute `/blogs` URL when `globalConfig.slug === 'settings'`; their Collection behavior stays unchanged.
- [ ] Run `corepack pnpm exec vitest run tests/int/settings.int.spec.ts`; confirm the new assertions fail because the SEO group/hook/global generator branch is absent.
- [ ] Add `seo` after `hero` inside the existing `listing` group. Reuse `OverviewField`, `MetaTitleField({ hasGenerateFn: true, overrides: { hooks: { beforeValidate: [trimText] } } })`, `MetaDescriptionField` likewise, `MetaImageField({ relationTo: 'media', overrides: { filterOptions: { mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] } } } })`, and `PreviewField({ hasGenerateFn: true })`. Set Overview/Preview paths to `blog.listing.seo.title`, `.description`, `.image`. Do not add `globals: ['settings']` to the plugin.
- [ ] Add a `GlobalBeforeChangeHook` `validateSettingsSeoImage`, registered after `validateSettingsHeroImage`, that reads incoming `data?.blog?.listing?.seo?.image` or retained `originalDoc` value; allows `undefined`/`null`; resolves the relationship through `req.payload.findByID({ collection: 'media', id: String(id), depth: 0, req })`; and rejects non-image MIME with a `ValidationError` at `blog.listing.seo.image`. Do not alter other Settings fields or inactive data.
- [ ] Extend the three plugin callbacks for `globalConfig?.slug === 'settings'`: title `Blogs`, description `Explore our latest blog articles, insights, and guides.`, URL `${getServerSideURL()}/blogs`. Keep existing Collection branches identical. Use types that permit the Global callback without any `any` cast.
- [ ] Run `corepack pnpm generate:types` and `corepack pnpm generate:importmap`. Verify the generated `Settings` type has `blog.listing.seo` and no hand edits. Run the focused test, `corepack pnpm exec tsc --noEmit --incremental false`, and `git diff --check`. Commit only task files as `feat: add Settings blog listing SEO fields`.

## Task 2: Normalize SEO data and render listing metadata

**Create:** `src/utilities/blogs/getBlogListingSEO.ts`, `tests/int/blog-listing-seo.int.spec.ts`.
**Modify:** `src/app/(frontend)/blogs/listing.tsx`, `tests/int/blog-routes.int.spec.tsx`.

- [ ] Write adapter tests first with `getCachedSettings` mocked. Cover missing `seo`, whitespace-only strings, trim, populated Media object, relationship ID, and Media object without URL. Return a model containing optional `title`, `description`, and absolute `imageURL`; resolve a populated Media URL with `new URL(image.url, getServerSideURL())`, never construct an R2 URL. Run `corepack pnpm exec vitest run tests/int/blog-listing-seo.int.spec.ts`; confirm red because adapter does not exist.
- [ ] Implement `getBlogListingSEO()` as a server-only adapter over `getCachedSettings()`. Return empty optional fields for missing settings; never leak the raw Global. A relationship ID or missing Media URL yields no custom image URL so the site default can be used.
- [ ] Extend `blog-routes.int.spec.tsx` with a mocked adapter. First assert custom settings change `/blogs` and `/blogs/page/2` standard title/description, Open Graph title/description/image/url, Twitter title/description/image, while preserving each canonical; page 2 appends ` — Page 2` and ` Page 2.`. Assert empty settings preserve existing defaults; category metadata never calls the adapter and remains unchanged. Run this file and confirm the new custom expectations fail.
- [ ] Change `blogListingMetadata` to call the adapter only when `categorySlug` is absent. For unfiltered routes, apply custom values or existing defaults, add page suffixes, and merge Open Graph defaults via `mergeOpenGraph`; set Twitter's `summary_large_image` title/description/image from the same result. Keep category return shape and current canonical paths intact. Do not read Hero or alter page rendering.
- [ ] Run `corepack pnpm exec vitest run tests/int/blog-listing-seo.int.spec.ts tests/int/blog-routes.int.spec.tsx`, TypeScript, and `git diff --check`. Commit only task files as `feat: render Settings SEO for blog listings`.

## Task 3: Verify real Admin and page output

- [ ] Run focused tests together: `corepack pnpm exec vitest run tests/int/settings.int.spec.ts tests/int/blog-listing-seo.int.spec.ts tests/int/blog-routes.int.spec.tsx tests/int/blog-listing-ui.int.spec.tsx`. Run `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm lint`, and `corepack pnpm build` with `DISABLE_R2_STORAGE=true` and a reported dedicated local MongoDB URI. Confirm the build still labels `/blogs`, its pagination and category listings static; separate Mongo connection failures from code failures.
- [ ] In an isolated local Payload environment, inspect `Globals → Settings → Blog → Listing page → SEO`: title/description/image, plugin overview/preview and generate buttons, saved values retained, MP4 excluded from picker, video relationship rejected by server validation. Use Payload's API, no direct MongoDB writes.
- [ ] Browser-check rendered `<title>`, description, canonical, Open Graph and Twitter tags for default `/blogs`, custom `/blogs`, `/blogs/page/2`, and a category page. Save settings through the running Payload service and confirm metadata refreshes without redeployment (allowing one stale-while-revalidate response). Keep temporary fixtures and browser artifacts out of Git; report any local media delivery limitation honestly.
- [ ] Run `git status --short`, `git diff --check`, and review commits. Preserve the three pre-existing untracked directories, leave the branch in place, and report exact verification results and limits. Do not merge or push.
