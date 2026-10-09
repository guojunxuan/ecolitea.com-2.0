# Settings Global · Blog Listing Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Payload `settings` Global whose Blog listing Hero content is editable and appears on unfiltered blog listing routes without changing the category or article pages.

**Architecture:** Payload owns `settings.blog.listing.hero`; a server-side adapter turns it into a stable presentation model. The existing static listing routes read that model, render a fixed Hero template when enabled, and keep the current title header as the fallback. The Global's cache tag and after-change hook refresh the public listing.

**Tech Stack:** Payload 4 canary, Next.js 16 App Router, React 19, CSS Modules, Vitest, MongoDB 7, pnpm.

**Source of truth:** `docs/superpowers/specs/2026-10-09-settings-blog-listing-hero-design.md` at commit `05afa42`. It supersedes the earlier conversational sketch: the heading is editable, and the Hero also appears on `/blogs/page/N`.

**Resolved type mismatch:** The design sketch writes `Media | number | null` for an unpopulated relationship, while this MongoDB project's generated media relationships use `string | Media`. Implement and test `Media | string | null` (see `src/payload-types.ts`); do not force generated types to match the sketch.

---

## Preconditions and boundaries

- [ ] Work on `feature/blogs-collection`; run `git status --short` and preserve the existing `.claude/`, `.playwright-cli/`, and `output/` directories. Reuse this checkout because the user explicitly selected this branch. Do not merge or push.
- [ ] Read `AGENTS.md`, `src/SiteSettings/config.ts`, `src/SiteSettings/fields/general.ts`, `src/SiteSettings/fields/validation.ts`, `src/utilities/getGlobals.ts`, `src/heros/HighImpact/index.tsx`, `src/heros/HeaderThemeSync.tsx`, `src/collections/mediaUploadPolicy.ts`, and the installed Next.js guides `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` and `node_modules/next/dist/docs/01-app/01-getting-started/12-images.md`. Inspect Payload's installed `GlobalConfig`, named `Tab`, `TextFieldValidation`, and upload-field `filterOptions` types before implementation.
- [ ] Do not edit the lockfile or `.env`. Generate `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js` only with `corepack pnpm generate:types` and `corepack pnpm generate:importmap`.
- [ ] Before any database-backed test, seed, or cleanup, report the exact MongoDB host and database name and whether `DISABLE_R2_STORAGE=true`. Run only the test files touched below; do not run full `test:int` or `test:e2e`.

## Task 1: Define the Settings Global and its Blog Hero schema

**Create:** `src/Settings/config.ts`, `src/Settings/fields/index.ts`, `src/Settings/fields/blog.ts`, `src/Settings/fields/validation.ts`, `src/Settings/hooks/revalidateSettings.ts`, `tests/int/settings.int.spec.ts`.

**Modify:** `src/payload.config.ts`, generated `src/payload-types.ts`, generated `src/app/(payload)/admin/importMap.js`.

- [ ] Add focused failing tests in `tests/int/settings.int.spec.ts`. Inspect the exported config rather than duplicating its implementation. Assert `slug: 'settings'`, `label: 'Settings'`, public read/authenticated update, `versions: false`, a named `blog` tab, and the `listing → hero` group path. Assert `enabled` defaults to `false`; the four other fields are shown only when enabled; `headerTheme` defaults to `light` and offers exactly `light`/`dark`; and `image.filterOptions.mimeType.in` equals `MEDIA_UPLOAD_POLICY.image.mimeTypes`. Exercise the heading validator with `(enabled=true, '   ')`, `(enabled=true, ' Tea ')`, and `(enabled=false, '')`, and the hook with and without `context.disableRevalidate`. Mock `next/cache` for the hook test.
- [ ] Run `corepack pnpm exec vitest run tests/int/settings.int.spec.ts` and confirm failures identify the missing Global/validation/hook. If Vitest requires MongoDB in this environment, use its dedicated test database with R2 disabled and report the exact target first.
- [ ] Implement `src/Settings/fields/validation.ts` with a `trimText` field hook and a typed `validateEnabledHeading: TextFieldValidation`. Call `validations.text(value, options)` first; return that error if present. Read `options.siblingData.enabled`; when false return `true`; when true accept only a string whose trimmed length is positive, otherwise return `'Heading is required when the Hero is enabled.'`. Do not clear hidden or disabled data.

  ```ts
  import type { FieldHook, TextFieldValidation } from 'payload'
  import { validations } from 'payload'

  export const trimText: FieldHook = ({ value }) =>
    typeof value === 'string' ? value.trim() : value

  export const validateEnabledHeading: TextFieldValidation = (value, options) => {
    const result = validations.text(value, options)
    if (result !== true) return result
    if (options.siblingData?.enabled !== true) return true
    return typeof value === 'string' && value.trim().length > 0
      ? true
      : 'Heading is required when the Hero is enabled.'
  }
  ```
- [ ] Implement `src/Settings/fields/blog.ts` as a named `Tab` with `name: 'blog'`, label `Blog`, `listing` group, and nested `hero` group. Hero fields, in order: checkbox `enabled` default `false`; text `heading` with `beforeValidate: [trimText]` and `validate: validateEnabledHeading`; optional textarea `description` with the same trim hook; optional upload `image` related to `media`, filtered to `MEDIA_UPLOAD_POLICY.image.mimeTypes`; select `headerTheme` default `light`, required, with `Light` and `Dark` options. The four fields after `enabled` use `admin.condition: (_, siblingData) => siblingData?.enabled === true`. Add the exact explanatory description `Use Dark for dark images (white text and header), Light for bright images or no image.` to the theme. Use native Payload fields only.

  ```ts
  import type { Tab } from 'payload'
  import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'
  import { trimText, validateEnabledHeading } from './validation'

  const whenEnabled = (_: unknown, siblingData: { enabled?: boolean }) =>
    siblingData?.enabled === true

  export const blogTab: Tab = {
    name: 'blog',
    label: 'Blog',
    fields: [{
      name: 'listing', type: 'group', label: 'Listing page', fields: [{
        name: 'hero', type: 'group', label: 'Hero', fields: [
          { name: 'enabled', type: 'checkbox', defaultValue: false },
          { name: 'heading', type: 'text', hooks: { beforeValidate: [trimText] },
            validate: validateEnabledHeading, admin: { condition: whenEnabled } },
          { name: 'description', type: 'textarea', hooks: { beforeValidate: [trimText] },
            admin: { condition: whenEnabled } },
          { name: 'image', type: 'upload', relationTo: 'media',
            filterOptions: { mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] } },
            admin: { condition: whenEnabled } },
          { name: 'headerTheme', type: 'select', required: true, defaultValue: 'light',
            options: [{ label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }],
            admin: { condition: whenEnabled, description:
              'Use Dark for dark images (white text and header), Light for bright images or no image.' } },
        ],
      }],
    }],
  }
  ```
- [ ] Implement `src/Settings/fields/index.ts` exporting a single `TabsField` with `tabs: [blogTab]`. Implement `src/Settings/config.ts` with `slug: 'settings'`, `label: 'Settings'`, `typescript.interface: 'Settings'`, `access.read: anyone`, `access.update: authenticated`, `fields: [settingsTabs]`, `versions: false`, and `hooks.afterChange: [revalidateSettings]`. Register `Settings` after `SiteSettings` in `src/payload.config.ts`.
- [ ] Implement `revalidateSettings: GlobalAfterChangeHook` with `revalidateTag('global_settings', 'max')` only when `!context.disableRevalidate`, returning `doc` in both cases. Follow `revalidateSiteSettings`' style and do not add database writes.

  ```ts
  import type { GlobalAfterChangeHook } from 'payload'
  import { revalidateTag } from 'next/cache'

  export const revalidateSettings: GlobalAfterChangeHook = ({ doc, req }) => {
    if (!req.context.disableRevalidate) revalidateTag('global_settings', 'max')
    return doc
  }
  ```
- [ ] Run `corepack pnpm generate:types` and `corepack pnpm generate:importmap`. Check that `Settings` and `Config['globals']['settings']` are generated, and that neither generated file was hand-edited. Run `corepack pnpm exec vitest run tests/int/settings.int.spec.ts`, `corepack pnpm exec tsc --noEmit --incremental false`, and `git diff --check`.
- [ ] Commit only this task's files with `feat: add Settings global for blog listing hero`.

## Task 2: Read and normalize the Hero content

**Create:** `src/utilities/blogs/getBlogListingHero.ts`, `tests/int/blog-listing-hero.int.spec.tsx`.

**Modify:** `src/utilities/getGlobals.ts`.

- [ ] First write the adapter tests in `tests/int/blog-listing-hero.int.spec.tsx`, mocking `getCachedSettings`. Cover a missing Global or missing `blog.listing.hero`, `enabled: false`, a whitespace-only heading, a valid heading and trimmed description, both theme values, and image relations represented by an object or an ID. Assert no Payload object leaks except the `Media` presentation input. Run `corepack pnpm exec vitest run tests/int/blog-listing-hero.int.spec.tsx` and confirm the adapter tests fail.
- [ ] Add `getCachedSettings = async () => getCachedGlobal('settings', 1)()` to `src/utilities/getGlobals.ts`. Reuse `getCachedGlobal`'s existing `global_settings` tag and Playwright bypass behavior; do not add a parallel cache.
- [ ] In `getBlogListingHero.ts`, export `BlogListingHeroModel` with `heading: string`, optional `description`, optional `image: Media | string | null`, and `headerTheme: 'light' | 'dark'`. Export `getBlogListingHero(): Promise<BlogListingHeroModel | null>`; read `getCachedSettings()`, return null unless `enabled === true` and the trimmed heading is nonempty, trim the optional description, pass through a populated media object or relationship ID, and normalize an unknown theme to `light`. Keep the function server-only and provider-neutral.

  ```ts
  import type { Media } from '@/payload-types'
  import { getCachedSettings } from '@/utilities/getGlobals'

  export type BlogListingHeroModel = {
    heading: string
    description?: string | null
    image?: Media | string | null
    headerTheme: 'light' | 'dark'
  }

  export async function getBlogListingHero(): Promise<BlogListingHeroModel | null> {
    const settings = await getCachedSettings()
    const hero = settings?.blog?.listing?.hero
    const heading = hero?.heading?.trim()
    if (hero?.enabled !== true || !heading) return null
    return {
      heading,
      description: hero.description?.trim() || null,
      image: hero.image ?? null,
      headerTheme: hero.headerTheme === 'dark' ? 'dark' : 'light',
    }
  }
  ```
- [ ] Rerun the new test, TypeScript, and `git diff --check`. Commit these files with `feat: normalize cached blog listing hero settings`.

## Task 3: Render the fixed Hero template

**Create:** `src/heros/BlogListingHero/index.tsx`, `src/heros/BlogListingHero/index.module.css`.

**Modify:** `tests/int/blog-listing-hero.int.spec.tsx`.

- [ ] Extend the focused test before implementation. Mock `Media` and `HeaderThemeSync`; assert one `<h1>` with the configured heading, optional description, `data-hero="blog-listing"`, and theme propagation. With an image object, assert the shared `Media` receives it and the image frame/scrim exist. With an image ID or no image, assert the page still renders its text and fallback surface without a broken image. Run the test and confirm the new cases fail.
- [ ] Implement a server component receiving only `BlogListingHeroModel`. Render a fixed `<section data-hero="blog-listing" data-website-theme={headerTheme === 'dark' ? 'inverse' : undefined}>` with `HeaderThemeSync`, an optional background `Media` only for a populated image object, and content containing the `<h1>` and optional description. Use `Media` with `fill`, `priority`, `size="100vw"`, an image presentation `{ image: { fit: 'cover', quality: 85 } }`, and a project-owned image class. Preserve the model's ID case as the no-image fallback; never construct an R2 URL in this component.

  ```tsx
  import { Media } from '@/components/Media'
  import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
  import type { BlogListingHeroModel } from '@/utilities/blogs/getBlogListingHero'
  import styles from './index.module.css'

  export function BlogListingHero({ hero }: { hero: BlogListingHeroModel }) {
    const hasImage = typeof hero.image === 'object' && hero.image !== null
    return (
      <section
        className={styles.root}
        data-hero="blog-listing"
        data-header-foreground={hero.headerTheme}
        data-website-theme={hero.headerTheme === 'dark' ? 'inverse' : undefined}
      >
        <HeaderThemeSync theme={hero.headerTheme} />
        {hasImage && (
          <div className={styles.mediaFrame}>
            <Media
              fill
              imgClassName={styles.image}
              presentation={{ image: { fit: 'cover', quality: 85 } }}
              priority
              resource={hero.image}
              size="100vw"
            />
          </div>
        )}
        {hasImage && <div aria-hidden="true" className={styles.scrim} />}
        <div className={styles.content}>
          <h1 className={styles.title}>{hero.heading}</h1>
          {hero.description && <p className={styles.description}>{hero.description}</p>}
        </div>
      </section>
    )
  }
  ```
- [ ] In CSS Modules, use a positioned, isolated, responsive banner; keep the text in the existing site container and align it toward the bottom left. Give the media frame `position: absolute; inset: 0` and the image `object-fit: cover`; use project `--website-*` spacing, color, size, and scrim tokens. The dark theme uses inverse foreground and a dark scrim; light uses normal foreground and a light overlay. Without an image use `--website-color-muted-surface` for light or `--website-color-brand-black` for dark. Respect small viewports and avoid horizontal overflow. Do not change global CSS or Admin internals.

  ```css
  .root {
    position: relative;
    isolation: isolate;
    display: flex;
    align-items: flex-end;
    min-height: clamp(22rem, 45vw, 38rem);
    background: var(--website-color-muted-surface);
    color: var(--website-color-foreground);
  }
  .root[data-header-foreground='dark'] {
    background: var(--website-color-brand-black);
    color: var(--website-color-brand-white);
  }
  .mediaFrame, .scrim { position: absolute; inset: 0; }
  .mediaFrame { z-index: 0; overflow: hidden; }
  .image { object-fit: cover; }
  .scrim { z-index: 1; background: rgb(255 255 255 / var(--website-scrim-standard)); }
  .root[data-header-foreground='dark'] .scrim {
    background: rgb(0 0 0 / var(--website-scrim-standard));
  }
  .content {
    position: relative;
    z-index: 2;
    width: min(100% - (2 * var(--website-gutter)), var(--website-container-site));
    margin-inline: auto;
    padding-block: var(--website-space-30) var(--website-space-16);
  }
  .title { composes: website-type-heading-1 from global; margin: 0; }
  .description { max-width: 42rem; margin-block: var(--website-space-4) 0; }
  @media (width < 48rem) {
    .root { min-height: 28rem; }
    .content { padding-block: var(--website-space-20) var(--website-space-12); }
  }
  ```
- [ ] Rerun `corepack pnpm exec vitest run tests/int/blog-listing-hero.int.spec.tsx`, `corepack pnpm exec tsc --noEmit --incremental false`, and `git diff --check`. Commit with `feat: render themed blog listing hero`.

## Task 4: Integrate on unfiltered blog listing routes

**Modify:** `src/app/(frontend)/blogs/listing.tsx`, `src/app/(frontend)/blogs/listing.module.css`, `tests/int/blog-routes.int.spec.tsx`.

- [ ] Add a mock for `getBlogListingHero` to `tests/int/blog-routes.int.spec.tsx` with a default null result, reset in `beforeEach`. Add route tests that set a model and render `/blogs` and `/blogs/page/2`: each should contain the Hero heading exactly once, omit the default `Blogs` `<h1>`, and retain the category tabs and cards. Add fallback tests for null, disabled/blank values as normalized by Task 2. Assert category and category-page routes never call `getBlogListingHero` and keep their breadcrumb/heading. Keep the static route and metadata assertions. Run this file and confirm the new expectations fail.
- [ ] In `renderBlogListing`, resolve `getBlogListingHero()` only when `categorySlug` is absent. Do not fetch it for category routes. Render `BlogListingHero` above tabs for the two unfiltered route shapes, or the existing header when the model is null; never render both headings. Keep `getBlogListing`, category counts, `BlogExplorer`, and `<noscript>` Pagination behavior unchanged. Do not add the Hero to `generateMetadata`.

  ```tsx
  const hero = categorySlug ? null : await getBlogListingHero()
  // Inside the existing page wrapper, before BlogCategoryTabs:
  {hero ? <BlogListingHero hero={hero} /> : (
    <header className={styles.header}>
      {category && (
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <Link href="/blogs">Blogs</Link>
          <span aria-hidden="true"> / </span>
          <span>{category.title}</span>
        </nav>
      )}
      <h1 className={styles.title}>{category ? `${category.title} Blogs` : 'Blogs'}</h1>
      {category?.description && <p className={styles.description}>{category.description}</p>}
    </header>
  )}
  ```
- [ ] Add a `hasHero` class only for the Hero branch in `listing.module.css`, adjusting page top padding so Hero plus tabs have one intentional gap. Keep the existing `.page` styling untouched for the fallback and category routes.

  ```tsx
  <div className={hero ? `${styles.page} ${styles.hasHero}` : styles.page}>
  ```

  ```css
  .hasHero { padding-top: 0; }
  .hasHero .tabs { margin-top: var(--website-section-standard); }
  ```
- [ ] Rerun `corepack pnpm exec vitest run tests/int/blog-routes.int.spec.tsx tests/int/blog-listing-ui.int.spec.tsx tests/int/blog-listing-hero.int.spec.tsx`, `corepack pnpm exec tsc --noEmit --incremental false`, and `git diff --check`. Commit with `feat: show managed hero on blog listing routes`.

## Task 5: Verify data flow and browser behavior

- [ ] Run the focused integration tests together: `corepack pnpm exec vitest run tests/int/settings.int.spec.ts tests/int/blog-listing-hero.int.spec.tsx tests/int/blog-routes.int.spec.tsx tests/int/blog-listing-ui.int.spec.tsx`. Run `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm lint`, and `corepack pnpm build` once. For the build, set `DISABLE_R2_STORAGE=true` and a reported, dedicated local MongoDB URI. Confirm the route output still marks `/blogs`, `/blogs/page/[pageNumber]`, and category listings as static. Separate database startup failures from code failures.
- [ ] In an isolated local environment, verify the native Admin path `Globals → Settings → Blog → Listing → Hero`: disabled fields hide while stored values persist; enabled with a blank heading fails server validation; an image picker excludes MP4. Set up this environment with Payload's API, no direct MongoDB writes, and report its exact host/database and storage target before creating content. Do not edit the user's existing development content.
- [ ] Browser-check `/blogs` on desktop and mobile with image + Dark, image + Light, no image + Light, no image + Dark, and disabled. For each, check one `<h1>`, Header foreground, text contrast, media fit, tabs spacing, and no horizontal overflow. Check `/blogs/page/2` uses the Hero and `/blogs/category/<slug>` does not. Verify a Settings save refreshes `/blogs` without a new deployment. Keep browser artifacts and generated test media out of Git.
- [ ] Run `git status --short` and `git diff --check`; preserve unrelated untracked files. Report exact passing commands, any warning or environmental limit, and the task commits. Leave the branch in place; do not merge or push.
