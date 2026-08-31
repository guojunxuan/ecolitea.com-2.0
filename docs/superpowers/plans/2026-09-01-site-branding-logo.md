# Site Branding Logo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let editors manage SVG logos and a favicon from Site Settings / Branding, then render those assets responsively in Header, Footer, and document metadata.

**Architecture:** A hidden native Payload Upload Collection stores brand assets while the Site Settings Global remains their visible management boundary. Server components read the cached Global at depth 1, a resolver converts Payload relationships to a presentation-only image shape, and a pure `Logo.tsx` renders SVG with a native `<img>`.

**Tech Stack:** Payload CMS 4 canary, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Vitest.

---

## File structure

- Create `src/collections/BrandAssets.ts`: hidden native Upload Collection for SVG, PNG, and ICO files.
- Create `src/SiteSettings/hooks/revalidateSiteSettings.ts`: invalidate the cached Global after saves.
- Create `src/components/Logo/types.ts`: presentation-only logo data contract.
- Create `src/components/Logo/resolveBrandAsset.ts`: isolate Payload relationship parsing and URL resolution.
- Modify `src/SiteSettings/fields/branding.ts`: point Branding fields at Brand Assets and filter each relationship by MIME type.
- Modify `src/SiteSettings/config.ts`: remove the Settings group and register the cache hook.
- Modify `src/payload.config.ts`: register Brand Assets.
- Modify `src/components/Logo/Logo.tsx`: replace the hard-coded Payload logo with a reusable native image renderer.
- Modify `src/Header/Component.tsx`: load and resolve Branding assets.
- Modify `src/Header/Component.client.tsx`: receive assets and choose the theme variant.
- Modify `src/Footer/Component.tsx`: resolve the inverse logo with primary fallback.
- Modify `src/app/(frontend)/layout.tsx`: emit configured favicon through `generateMetadata` and retain static fallback.
- Modify `tests/int/site-settings.int.spec.ts`: verify schema, access, hook, and Global navigation placement.
- Create `tests/int/brand-assets.int.spec.ts`: verify the hidden collection and accepted MIME types.
- Create `tests/int/logo.int.spec.tsx`: verify relationship resolution and native responsive rendering.
- Regenerate `src/payload-types.ts`.

### Task 1: Brand Assets collection and Branding relationships

**Files:**
- Create: `src/collections/BrandAssets.ts`
- Modify: `src/payload.config.ts`
- Modify: `src/SiteSettings/fields/branding.ts`
- Create: `tests/int/brand-assets.int.spec.ts`
- Modify: `tests/int/site-settings.int.spec.ts`

- [ ] **Step 1: Write failing schema tests**

Add assertions that `BrandAssets.slug` is `brand-assets`, `admin.hidden` is `true`, access reuses `anyone` and `authenticated`, upload MIME types equal `['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon']`, and Payload config registers the collection. Update the Branding assertions so `logo`, `logoDark`, and `favicon` all use `relationTo: 'brand-assets'`; logo fields filter `mimeType` to SVG and favicon filters the supported icon types.

```ts
expect(BrandAssets.admin?.hidden).toBe(true)
expect(BrandAssets.upload).toMatchObject({
  mimeTypes: ['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
})
expect(logoField).toMatchObject({
  type: 'upload',
  relationTo: 'brand-assets',
  required: true,
  filterOptions: { mimeType: { equals: 'image/svg+xml' } },
})
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `pnpm test:int -- tests/int/brand-assets.int.spec.ts tests/int/site-settings.int.spec.ts`

Expected: FAIL because `BrandAssets` does not exist and Branding still relates to `media`.

- [ ] **Step 3: Implement the hidden Upload Collection and relationship filters**

Create the collection using native Payload configuration:

```ts
export const BrandAssets: CollectionConfig = {
  slug: 'brand-assets',
  admin: { hidden: true, useAsTitle: 'filename' },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [{ name: 'alt', type: 'text', required: true }],
  upload: {
    mimeTypes: ['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
  },
}
```

Register `BrandAssets` in `collections`, then change the three Branding relationships and add editor descriptions. Use the exact filters asserted by the tests.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm test:int -- tests/int/brand-assets.int.spec.ts tests/int/site-settings.int.spec.ts`

Expected: PASS.

```bash
git add src/collections/BrandAssets.ts src/payload.config.ts src/SiteSettings/fields/branding.ts tests/int/brand-assets.int.spec.ts tests/int/site-settings.int.spec.ts
git commit -m "feat: add managed brand asset storage"
```

### Task 2: Site Settings placement and cache invalidation

**Files:**
- Create: `src/SiteSettings/hooks/revalidateSiteSettings.ts`
- Modify: `src/SiteSettings/config.ts`
- Modify: `tests/int/site-settings.int.spec.ts`

- [ ] **Step 1: Write failing configuration tests**

Assert that `SiteSettings.admin?.group` is undefined and `SiteSettings.hooks?.afterChange` contains `revalidateSiteSettings`. Unit-test the hook with `vi.mock('next/cache')`, asserting `revalidateTag('global_site-settings', 'max')` unless `context.disableRevalidate` is true.

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test:int -- tests/int/site-settings.int.spec.ts`

Expected: FAIL because the Global is grouped under Settings and has no hook.

- [ ] **Step 3: Implement the hook and update the Global**

Follow the Header/Footer hook pattern:

```ts
export const revalidateSiteSettings: GlobalAfterChangeHook = ({ doc, req: { payload, context } }) => {
  if (!context.disableRevalidate) {
    payload.logger.info('Revalidating site settings')
    revalidateTag('global_site-settings', 'max')
  }
  return doc
}
```

Remove `admin.group` entirely and register `hooks: { afterChange: [revalidateSiteSettings] }`.

- [ ] **Step 4: Run the test and commit**

Run: `pnpm test:int -- tests/int/site-settings.int.spec.ts`

Expected: PASS.

```bash
git add src/SiteSettings/config.ts src/SiteSettings/hooks/revalidateSiteSettings.ts tests/int/site-settings.int.spec.ts
git commit -m "feat: revalidate site settings branding"
```

### Task 3: Presentation resolver and native Logo component

**Files:**
- Create: `src/components/Logo/types.ts`
- Create: `src/components/Logo/resolveBrandAsset.ts`
- Modify: `src/components/Logo/Logo.tsx`
- Create: `tests/int/logo.int.spec.tsx`

- [ ] **Step 1: Write failing resolver and component tests**

Test that an ID relationship and an object without `url` resolve to `null`; a populated Brand Asset resolves its URL through `getMediaUrl`, carries alt text, and uses positive intrinsic dimensions with safe defaults. Render `Logo` and assert it creates an `img` with the supplied `src`, `alt`, `width`, `height`, loading, fetch priority, and responsive classes. Assert `Logo` returns `null` for missing data.

```tsx
expect(resolveBrandAsset(12)).toBeNull()
expect(resolveBrandAsset({ url: '/brand.svg', alt: 'Ecolitea', width: 1302, height: 296 } as BrandAsset))
  .toMatchObject({ src: expect.stringContaining('/brand.svg'), alt: 'Ecolitea', width: 1302, height: 296 })
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm test:int -- tests/int/logo.int.spec.tsx`

Expected: FAIL because the resolver and new component contract do not exist.

- [ ] **Step 3: Implement the isolated presentation contract**

Define:

```ts
export type LogoImage = {
  src: string
  alt: string
  width: number
  height: number
}
```

Implement `resolveBrandAsset(asset)` using the generated `BrandAsset` type, `getMediaUrl`, and conservative `width`/`height` fallbacks that preserve the supplied SVG's horizontal ratio when metadata is absent. Refactor `Logo.tsx` to accept `image: LogoImage | null`, loading, fetch priority, and className, then render:

```tsx
<img
  src={image.src}
  alt={image.alt}
  width={image.width}
  height={image.height}
  loading={loading}
  fetchPriority={priority}
  decoding="async"
  className={clsx('block h-auto w-auto max-w-full', className)}
/>
```

- [ ] **Step 4: Run tests and commit**

Run: `pnpm test:int -- tests/int/logo.int.spec.tsx`

Expected: PASS.

```bash
git add src/components/Logo tests/int/logo.int.spec.tsx
git commit -m "feat: render configured svg logos"
```

### Task 4: Header and Footer integration

**Files:**
- Modify: `src/Header/Component.tsx`
- Modify: `src/Header/Component.client.tsx`
- Modify: `src/Footer/Component.tsx`
- Modify: `tests/int/logo.int.spec.tsx`

- [ ] **Step 1: Add failing integration-boundary tests**

Extract and test a small exported `selectLogo(primary, inverse, useInverse)` helper: inverse mode selects `logoDark` when present and falls back to `logo`; normal mode selects `logo`. Add source-level or component tests confirming Header and Footer no longer invoke `Logo` without image data.

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test:int -- tests/int/logo.int.spec.tsx`

Expected: FAIL because Header/Footer do not receive Site Settings branding.

- [ ] **Step 3: Connect server data to presentation components**

Fetch Header/Footer data and `getCachedGlobal('site-settings', 1)()` in parallel. Resolve `logo` and `logoDark` at the server boundary. Pass both to `HeaderClient`; select the theme-appropriate asset there without Payload imports. In Footer, select `logoDark ?? logo`. Use layout-specific responsive classes such as `h-7 sm:h-8 lg:h-10 w-auto max-w-full` and remove the hard-coded Payload inversion behavior.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm test:int -- tests/int/logo.int.spec.tsx`

Expected: PASS.

```bash
git add src/Header/Component.tsx src/Header/Component.client.tsx src/Footer/Component.tsx tests/int/logo.int.spec.tsx
git commit -m "feat: use site branding in header and footer"
```

### Task 5: Dynamic favicon with static fallback

**Files:**
- Modify: `src/app/(frontend)/layout.tsx`
- Modify: `tests/int/logo.int.spec.tsx`

- [ ] **Step 1: Write failing favicon metadata tests**

Test a pure exported `resolveFavicon(asset)` helper so a populated asset produces `{ url, type }` and a missing asset returns the existing `/favicon.ico` and `/favicon.svg` fallback list.

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test:int -- tests/int/logo.int.spec.tsx`

Expected: FAIL because favicon metadata is static.

- [ ] **Step 3: Implement metadata generation using installed Next.js guidance**

Replace the static `metadata` export with `generateMetadata(): Promise<Metadata>` because Next.js forbids exporting both. Read Site Settings at depth 1, resolve favicon, and merge the existing metadata fields with:

```ts
icons: configuredFavicon
  ? { icon: [{ url: configuredFavicon.url, type: configuredFavicon.type }] }
  : { icon: [{ url: '/favicon.ico', sizes: '32x32' }, { url: '/favicon.svg', type: 'image/svg+xml' }] }
```

Remove the manually duplicated favicon links from `<head>` while retaining `InitTheme`.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm test:int -- tests/int/logo.int.spec.tsx`

Expected: PASS.

```bash
git add 'src/app/(frontend)/layout.tsx' tests/int/logo.int.spec.tsx
git commit -m "feat: configure favicon from site settings"
```

### Task 6: Generate types and validate test assets

**Files:**
- Modify: `src/payload-types.ts`
- Test input: `/Users/jason/Desktop/full logo.svg`
- Test input: `/Users/jason/Desktop/icon.png`

- [ ] **Step 1: Generate Payload types**

Run: `pnpm generate:types`

Expected: `BrandAsset` is generated, `SiteSettings.logo`, `logoDark`, and `favicon` reference `BrandAsset`, and no unrelated schema errors occur.

- [ ] **Step 2: Run the full integration suite**

Run: `pnpm test:int`

Expected: all integration tests PASS.

- [ ] **Step 3: Upload and assign the provided test assets**

Using the running local Payload instance and an authenticated Admin session, upload `full logo.svg` through Branding's Logo Create New drawer and `icon.png` through the Favicon drawer. Save Site Settings, then verify a depth-1 Global read returns populated Brand Asset objects. Do not copy either Desktop file into the repository.

- [ ] **Step 4: Verify responsive frontend behavior**

At widths 375, 768, and 1440, confirm Header and Footer display the SVG without distortion, the rendered width follows the source ratio, and the page head points to the uploaded PNG favicon. Confirm Brand Assets is absent from the normal Admin navigation.

- [ ] **Step 5: Commit generated types**

```bash
git add src/payload-types.ts
git commit -m "chore: generate brand asset types"
```

### Task 7: Production verification

**Files:**
- Verify only; fix scoped failures in the files introduced by Tasks 1-6.

- [ ] **Step 1: Run source formatting and diff checks**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 2: Run the production build**

Run: `pnpm build`

Expected: Payload/Next production build and sitemap generation complete successfully.

- [ ] **Step 3: Run lint and classify pre-existing infrastructure failure**

Run: `pnpm lint`

Expected: no errors from changed source files. If the known FlatCompat circular-serialization failure occurs before source inspection, record it verbatim rather than presenting lint as passing.

- [ ] **Step 4: Review final scope and commit any scoped corrections**

Confirm there is no Default SEO, inquiry configuration, mobile logoMark, custom Admin component, SVG inlining, or future Settings implementation. Preserve unrelated untracked `AGENTS.md` and `CLAUDE.md` files.

```bash
git add src tests
git commit -m "fix: complete site branding integration"
```

Only create the final correction commit when Task 7 actually changes scoped files.
