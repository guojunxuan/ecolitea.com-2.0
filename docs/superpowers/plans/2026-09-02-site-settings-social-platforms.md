# Site Settings Social Platforms Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add database-backed reusable social platforms and a compact Site Settings creation Modal while preserving the existing Social Link label and URL behavior.

**Architecture:** Register a hidden-from-navigation `social-platforms` Payload Collection and change `site-settings.socialLinks[].platform` from a hard-coded select to a relationship. Keep Payload responsible for schema, access, persistence, uploads, and generated types; isolate the custom Modal and relationship option orchestration under `src/SiteSettings/components/` using public `@payloadcms/ui` exports.

**Tech Stack:** Payload CMS 4 canary, Next.js 16 App Router, React 19, TypeScript 6, MongoDB, Vitest, Testing Library, Playwright.

---

## File Structure

- Create `src/collections/SocialPlatforms.ts`: Collection identity, access, Admin metadata, Platform/Icon fields, and server-side SVG validation.
- Modify `src/payload.config.ts`: register the Collection.
- Modify `src/SiteSettings/fields/social.ts`: relationship schema, UI action registration, and removal of hard-coded options.
- Modify `src/SiteSettings/fields/index.ts`: stop exporting removed options.
- Create `src/SiteSettings/components/SocialPlatformCreateModal.tsx`: shared compact Modal and Payload-backed create submission.
- Create `src/SiteSettings/components/SocialPlatformCreateActions.tsx`: top-level Social action that opens the shared Modal.
- Create `src/SiteSettings/components/SocialPlatformRelationshipField.tsx`: native relationship input, appended create option, row assignment, and shared Modal.
- Create `src/SiteSettings/components/socialPlatformCreateModal.scss`: Modal-only sizing and layout using Payload tokens.
- Modify `tests/int/site-settings.int.spec.ts`: schema and registration tests.
- Create `tests/int/social-platform-admin.int.spec.tsx`: Modal state and relationship assignment component tests.
- Modify `tests/e2e/admin.e2e.spec.ts`: authenticated end-to-end creation flow.
- Modify `src/endpoints/seed/index.ts`: seed Social Platform records before Site Settings relationships.
- Regenerate `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js`.

### Task 1: Social Platform Collection Schema

**Files:**
- Create: `src/collections/SocialPlatforms.ts`
- Modify: `src/payload.config.ts`
- Test: `tests/int/site-settings.int.spec.ts`

- [ ] **Step 1: Write failing Collection configuration tests**

Add assertions that import `SocialPlatforms`, verify `slug`, access functions, hidden navigation, `useAsTitle`, required Platform, required SVG Icon upload relationship, and root config registration:

```ts
import { SocialPlatforms } from '@/collections/SocialPlatforms'

it('defines reusable social platforms without an Admin navigation entry', () => {
  expect(SocialPlatforms).toMatchObject({
    slug: 'social-platforms',
    admin: { hidden: true, useAsTitle: 'platform' },
    access: {
      create: authenticated,
      delete: authenticated,
      read: anyone,
      update: authenticated,
    },
  })

  expect(SocialPlatforms.fields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'platform', type: 'text', required: true }),
      expect.objectContaining({
        name: 'icon',
        type: 'upload',
        relationTo: 'brand-assets',
        required: true,
        filterOptions: { mimeType: { equals: 'image/svg+xml' } },
      }),
    ]),
  )
})
```

Add a validation test that supplies a mocked Payload request returning an SVG Brand Asset and a PNG Brand Asset. Expect SVG to return `true` and PNG to return `Social platform icons must be SVG files.`. This tests server enforcement rather than relying only on `filterOptions`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
corepack pnpm test:int -- tests/int/site-settings.int.spec.ts
```

Expected: failure because `@/collections/SocialPlatforms` does not exist.

- [ ] **Step 3: Implement the minimal Collection and registration**

Create:

```ts
import type { CollectionConfig } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'

export const socialPlatformsSlug = 'social-platforms' as const

export const SocialPlatforms: CollectionConfig = {
  slug: socialPlatformsSlug,
  admin: {
    hidden: true,
    useAsTitle: 'platform',
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    { name: 'platform', type: 'text', required: true },
    {
      name: 'icon',
      type: 'upload',
      relationTo: 'brand-assets',
      required: true,
      filterOptions: { mimeType: { equals: 'image/svg+xml' } },
    },
  ],
}
```

Define and export `validateSocialPlatformIcon` in the same Collection file. It must accept an ID or populated Brand Asset, use an already populated `mimeType` when present, otherwise query `brand-assets` through `req.payload.findByID`, and return `true` only for `image/svg+xml`. Attach it to the Icon field as `validate`. Keep `filterOptions` for Admin selection UX, but treat validation as the security/data-integrity boundary.

Import `SocialPlatforms` in `src/payload.config.ts` and place it beside `BrandAssets` in `collections`.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: Collection assertions pass.

- [ ] **Step 5: Commit**

```bash
git add src/collections/SocialPlatforms.ts src/payload.config.ts tests/int/site-settings.int.spec.ts
git commit -m "feat: add reusable social platforms collection"
```

### Task 2: Site Settings Relationship Schema

**Files:**
- Modify: `src/SiteSettings/fields/social.ts`
- Modify: `src/SiteSettings/fields/index.ts`
- Test: `tests/int/site-settings.int.spec.ts`

- [ ] **Step 1: Write a failing relationship schema test**

Locate `socialLinks` from `socialTab.fields` and assert:

```ts
expect(platform).toMatchObject({
  name: 'platform',
  type: 'relationship',
  relationTo: 'social-platforms',
  required: true,
  admin: {
    allowCreate: false,
    components: {
      Field: '@/SiteSettings/components/SocialPlatformRelationshipField#SocialPlatformRelationshipField',
    },
  },
})

expect(label).toMatchObject({ name: 'label', type: 'text' })
expect(url).toMatchObject({ name: 'url', type: 'text', required: true })
expect(socialTab.fields).toEqual(
  expect.arrayContaining([
    expect.objectContaining({
      name: 'createSocialPlatform',
      type: 'ui',
      admin: {
        components: {
          Field: '@/SiteSettings/components/SocialPlatformCreateActions#SocialPlatformCreateActions',
        },
      },
    }),
  ]),
)
```

- [ ] **Step 2: Run the focused test and verify RED**

Run the Task 1 test command. Expected: `platform` is still a select and the UI field is absent.

- [ ] **Step 3: Implement the relationship and UI field configuration**

Remove `socialPlatformOptions` and `SelectField` usage. Import `socialPlatformsSlug`. Add a top-level UI field before the array and configure the relationship field exactly as asserted. Keep `validateAbsoluteHttpURL`, Label, URL, and their descriptions unchanged.

Remove `socialPlatformOptions` from `src/SiteSettings/fields/index.ts` exports.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command. Expected: Site Settings schema tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/SiteSettings/fields/social.ts src/SiteSettings/fields/index.ts tests/int/site-settings.int.spec.ts
git commit -m "feat: relate social links to social platforms"
```

### Task 3: Shared Modal State and Submission

**Files:**
- Create: `src/SiteSettings/components/SocialPlatformCreateModal.tsx`
- Create: `src/SiteSettings/components/socialPlatformCreateModal.scss`
- Test: `tests/int/social-platform-admin.int.spec.tsx`

- [ ] **Step 1: Write failing component tests**

Use Testing Library with focused mocks for network and Payload UI primitives. Assert that the Modal:

```tsx
render(
  <SocialPlatformCreateModal
    modalSlug="create-social-platform-test"
    onCreated={onCreated}
    open
  />,
)

expect(screen.getByRole('dialog', { name: 'Create Social Platform' })).toBeVisible()
expect(screen.getByLabelText('Platform')).toBeRequired()
expect(screen.getByText('Icon')).toBeVisible()
expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible()
expect(screen.getByRole('button', { name: 'Save' })).toBeVisible()
```

Add tests for Cancel without POST, failed validation preserving Platform text, one POST during double click, and `onCreated` receiving the returned document.

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
corepack pnpm test:int -- tests/int/social-platform-admin.int.spec.tsx
```

Expected: failure because the Modal component does not exist.

- [ ] **Step 3: Implement the Modal with public Payload UI exports**

Use `DialogModal`, `DialogHeader`, `DialogBody`, `DialogFooter`, `DialogCancel`, `DialogConfirm`, `TextInput`, `UploadInput`, `useConfig`, and `useModal` from `@payloadcms/ui`. Keep local state limited to `platform`, `icon`, validation messages, and saving status.

Build the collection endpoint from Admin configuration:

```ts
const {
  config: {
    routes: { api },
    serverURL,
  },
} = useConfig()

const endpoint = `${serverURL || ''}${api}/${socialPlatformsSlug}`
```

Submit JSON containing only `{ platform, icon }`, surface Payload's response errors, and call `onCreated(doc)` on success. Configure `UploadInput` with `relationTo="brand-assets"`, `allowCreate`, a single value, and SVG filter options. Use `DialogModal` to inherit focus trapping and Escape behavior.

The SCSS file must scope all selectors under `.social-platform-create-modal`, use Payload CSS variables for spacing/colors, set a medium dialog width near 520px, and align footer actions right. Do not target global Drawer, sidebar, or Relationship selectors.

- [ ] **Step 4: Run the component test and verify GREEN**

Run the Step 2 command. Expected: Modal tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/SiteSettings/components/SocialPlatformCreateModal.tsx src/SiteSettings/components/socialPlatformCreateModal.scss tests/int/social-platform-admin.int.spec.tsx
git commit -m "feat: add social platform creation modal"
```

### Task 4: Top-Level and Relationship Creation Entry Points

**Files:**
- Create: `src/SiteSettings/components/SocialPlatformCreateActions.tsx`
- Create: `src/SiteSettings/components/SocialPlatformRelationshipField.tsx`
- Modify: `tests/int/social-platform-admin.int.spec.tsx`

- [ ] **Step 1: Write failing action and relationship tests**

Assert that the top action opens the shared Modal. For the relationship field, assert that `formatDisplayedOptions` appends one `Create Social Platform` option and that selecting it opens the Modal without changing the relationship value. After successful creation, assert the field receives the returned ID:

```ts
expect(setValue).not.toHaveBeenCalled()
await completePlatformCreation({ id: 'platform-id', platform: 'LinkedIn' })
expect(setValue).toHaveBeenCalledWith('platform-id')
```

- [ ] **Step 2: Run the component test and verify RED**

Run the Task 3 test command. Expected: missing action and relationship components.

- [ ] **Step 3: Implement both entry points**

`SocialPlatformCreateActions` renders a Payload `Button` and the shared Modal.

`SocialPlatformRelationshipField` uses `useField` for the current path and renders public `RelationshipInput` with `allowCreate={false}`. Append a synthetic final option with a module-level sentinel value such as `__create_social_platform__`; intercept that value before calling `setValue`. On creation, call `setValue(doc.id)` and close the Modal. Do not query or modify the DOM.

Use unique modal slugs derived from the field path so multiple expanded Social rows do not share Modal state.

- [ ] **Step 4: Run the component test and verify GREEN**

Run the Task 3 command. Expected: action, sentinel interception, and row assignment tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/SiteSettings/components/SocialPlatformCreateActions.tsx src/SiteSettings/components/SocialPlatformRelationshipField.tsx tests/int/social-platform-admin.int.spec.tsx
git commit -m "feat: connect social platform modal to site settings"
```

### Task 5: Seed Data and Generated Artifacts

**Files:**
- Modify: `src/endpoints/seed/index.ts`
- Modify: `src/payload-types.ts`
- Modify: `src/app/(payload)/admin/importMap.js`
- Test: `tests/int/site-settings.int.spec.ts`

- [ ] **Step 1: Add a failing generated-shape assertion**

Add a type-level fixture or schema assertion verifying that a Site Settings Social Link platform accepts a `SocialPlatform | string` relationship value and that `Config['collections']['social-platforms']` exists.

- [ ] **Step 2: Run type generation baseline and observe the missing model**

Run:

```bash
corepack pnpm generate:types
corepack pnpm generate:importmap
```

Before Collection registration artifacts are regenerated, the new type/import assertions fail or the import map lacks the custom Admin components.

- [ ] **Step 3: Update seed ordering and regenerate**

Create or resolve SVG Brand Asset records first, create Social Platform records next, then update Site Settings Social Links using the created document IDs. Use seed-local maps keyed by fixture name only during the seed operation; do not export platform options into runtime code.

Run both generation commands and retain only generated changes related to this feature.

- [ ] **Step 4: Verify generated artifacts and focused tests**

Run:

```bash
corepack pnpm test:int -- tests/int/site-settings.int.spec.ts tests/int/social-platform-admin.int.spec.tsx
```

Expected: both suites pass and generated types contain `SocialPlatform`.

- [ ] **Step 5: Commit**

```bash
git add src/endpoints/seed/index.ts src/payload-types.ts 'src/app/(payload)/admin/importMap.js' tests/int/site-settings.int.spec.ts
git commit -m "chore: seed and generate social platform data"
```

### Task 6: End-to-End Admin Workflow

**Files:**
- Modify: `tests/e2e/admin.e2e.spec.ts`

- [ ] **Step 1: Write the failing authenticated workflow**

Add a test that opens Site Settings Social, opens the top action Modal, verifies the complete Admin including sidebar is inert, checks bottom-right Cancel/Save order, creates or selects a test SVG Brand Asset, saves a unique platform, opens a Social Link row, and verifies the new platform appears as a relationship option. Add a second path that opens the relationship create option and verifies the created ID is assigned to that row.

- [ ] **Step 2: Run the E2E test and verify RED**

Run:

```bash
corepack pnpm test:e2e -- tests/e2e/admin.e2e.spec.ts
```

Expected: failure until the complete Modal integration and generated import map are active.

- [ ] **Step 3: Fix only integration defects exposed by E2E**

Limit changes to accessibility names, Modal portal layering, option refresh, row assignment, and test-safe cleanup. Do not broaden the schema or alter frontend Footer code.

- [ ] **Step 4: Run E2E and focused integration tests**

Run:

```bash
corepack pnpm test:e2e -- tests/e2e/admin.e2e.spec.ts
corepack pnpm test:int -- tests/int/site-settings.int.spec.ts tests/int/social-platform-admin.int.spec.tsx
```

Expected: all targeted tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/admin.e2e.spec.ts src/SiteSettings/components
git commit -m "test: cover social platform admin workflow"
```

### Task 7: Final Verification

**Files:**
- Verify all files changed in Tasks 1–6.

- [ ] **Step 1: Generate artifacts from a clean working state**

Run:

```bash
corepack pnpm generate:types
corepack pnpm generate:importmap
```

Expected: commands complete without unexpected diffs after a second run.

- [ ] **Step 2: Run focused tests**

Run the Task 6 verification commands. Expected: pass.

- [ ] **Step 3: Run repository type checking and diff checks**

Run:

```bash
corepack pnpm exec tsc --noEmit
git diff --check
git status --short
```

Expected: no new TypeScript errors from Social Platform work and no whitespace errors. Record separately any known pre-existing frontend Footer errors caused by the already-approved Footer schema migration.

- [ ] **Step 4: Inspect scope**

Confirm no public Footer component changed, no platform options remain hard-coded, no Payload package files changed, and untracked environment files remain untouched.

- [ ] **Step 5: Finish with a clean feature diff**

If verification required corrections, stage each corrected Social Platform file explicitly and commit with `git commit -m "fix: finalize social platform admin integration"`. If no corrections were required, leave the verified commits unchanged.
