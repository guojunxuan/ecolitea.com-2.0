# Header Admin Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the configuration-first Payload Admin Header model with single-level links, explicit optional CTA behavior, normalized and validated navigation, useful native Array editing, and no frontend adaptation.

**Architecture:** Keep declarative field construction in `src/Header/fields`, pure Header policy in `src/Header/validators`, and string transformation in a focused Header hook. Reuse the existing `link()` factory's `labelOverrides`, `urlOverrides`, and `overrides` extension points; move generic text and URL validators into a shared field utility so Header and Footer opt in without importing each other.

**Tech Stack:** TypeScript, Payload CMS 4 canary field configuration and hooks, Vitest, MongoDB through Payload Local API, generated Payload types and import map.

---

## File Map

- Create `src/fields/linkValidation.ts`: reusable trim, non-blank, and supported-navigation-URL helpers.
- Modify `src/fields/link.ts`: no new Header policy; preserve and test its existing configuration extension points.
- Modify `src/Footer/validation.ts`: consume or re-export shared helpers while retaining Footer-only duplicate policy.
- Modify `src/Footer/config.ts`: point Footer configuration at the shared helpers without behavior changes.
- Modify `src/Header/fields/navigationItems.ts`: labels, horizontal Radio, single-level conditional Direct Link, and field overrides.
- Modify `src/Header/fields/dropdown.ts`: Description Link labels, bounds, and configured shared links.
- Modify `src/Header/fields/dropdownItems.ts`: horizontal Radio, defaults, labels, bounds, and configured shared links.
- Modify `src/Header/config.ts`: authenticated updates, optional CTA toggle, CTA condition, normalization hook, and Global validation.
- Replace `src/Header/validators/validateNavigation.ts`: pure active-branch completeness, label uniqueness, and destination uniqueness.
- Create `src/Header/hooks/normalizeHeader.ts`: recursively trim Header-owned strings before persistence.
- Modify `src/Header/RowLabel.tsx`: stable Navigation Item fallback wording.
- Modify `src/Header/DropdownItemRowLabel.tsx`: summarize only the active item branch.
- Modify `tests/int/header-link-factory.int.spec.ts`: protect opt-in link overrides and shared validation behavior.
- Modify `tests/int/footer-config.int.spec.ts`: prove the shared-helper refactor does not change Footer behavior.
- Replace or expand `tests/int/header-navigation.int.spec.ts`: schema and business-rule coverage.
- Create `tests/int/header-normalization.int.spec.ts`: normalization coverage.
- Create `tests/int/header-admin.int.spec.tsx`: Row Label rendering coverage if pure helpers are not extracted.
- Modify `src/payload-types.ts`: generated output only.
- Modify `src/app/(payload)/admin/importMap.js`: generated output only.
- Create temporarily `scripts/clear-development-header.ts`: narrowly scoped, explicit Local API reset command that is always removed after the one-time reset.

## Task 1: Share Opt-in Link Text and URL Validation

**Files:**
- Create: `src/fields/linkValidation.ts`
- Modify: `src/Footer/validation.ts`
- Modify: `src/Footer/config.ts`
- Modify: `tests/int/header-link-factory.int.spec.ts`
- Modify: `tests/int/footer-config.int.spec.ts`

- [ ] **Step 1: Write failing shared-helper tests**

Add assertions that the shared helpers trim strings, reject whitespace-only labels, accept exactly the supported URL families, and reject plain text, protocol-relative URLs, JavaScript URLs, and malformed mail/tel values:

```ts
import {
  trimText,
  validateNavigationURL,
  validateNonBlankText,
} from '@/fields/linkValidation'

expect(trimText({ value: '  About  ' } as never)).toBe('About')
expect(validateNonBlankText('   ')).toBeTypeOf('string')
expect(validateNonBlankText(' About ')).toBe(true)

for (const value of [
  'https://example.com/path',
  'http://example.com',
  '/about',
  '#contact',
  'mailto:hello@example.com',
  'tel:+86 123-456',
]) {
  expect(validateNavigationURL(value)).toBe(true)
}

for (const value of ['example.com', '//example.com', 'javascript:alert(1)', 'mailto:no-at', 'tel:abc']) {
  expect(validateNavigationURL(value)).toBeTypeOf('string')
}
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-link-factory.int.spec.ts tests/int/footer-config.int.spec.ts
```

Expected: FAIL because `@/fields/linkValidation` does not exist.

- [ ] **Step 3: Implement shared helpers**

Create `src/fields/linkValidation.ts`:

```ts
import type { FieldHook } from 'payload'

export const trimText: FieldHook = ({ value }) =>
  typeof value === 'string' ? value.trim() : value

export const validateNonBlankText = (value?: unknown): string | true =>
  typeof value === 'string' && value.trim().length > 0
    ? true
    : 'Enter a value that is not only whitespace.'

export const validateNavigationURL = (value?: unknown): string | true => {
  if (typeof value !== 'string' || value.trim().length === 0) return 'Enter a custom URL.'

  const url = value.trim()
  const supported =
    /^https?:\/\/[^\s]+$/i.test(url) ||
    /^\/(?!\/)[^\s]*$/.test(url) ||
    /^#[^\s]+$/.test(url) ||
    /^mailto:[^\s@]+@[^\s@]+$/i.test(url) ||
    /^tel:\+?[0-9().\-\s]+$/i.test(url)

  return supported ? true : 'Use http(s), a root-relative path, an anchor, mailto, or tel URL.'
}
```

Update Footer imports to use these helpers. Preserve `validateFooterURL` as a compatibility re-export if existing tests or callers rely on its name:

```ts
export { trimText, validateNonBlankText } from '@/fields/linkValidation'
export { validateNavigationURL as validateFooterURL } from '@/fields/linkValidation'
```

Keep Footer-only column and destination duplicate validators in `src/Footer/validation.ts`.

- [ ] **Step 4: Run shared and Footer tests**

Run the command from Step 2.

Expected: PASS; Footer schema assertions remain unchanged.

- [ ] **Step 5: Commit the shared refactor**

```bash
git add src/fields/linkValidation.ts src/Footer/validation.ts src/Footer/config.ts tests/int/header-link-factory.int.spec.ts tests/int/footer-config.int.spec.ts
git commit -m "refactor: share navigation link validation"
```

## Task 2: Configure the Header Field Model

**Files:**
- Modify: `src/Header/fields/navigationItems.ts`
- Modify: `src/Header/fields/dropdown.ts`
- Modify: `src/Header/fields/dropdownItems.ts`
- Modify: `tests/int/header-navigation.int.spec.ts`

- [ ] **Step 1: Write failing schema assertions**

Assert all of the following in `tests/int/header-navigation.int.spec.ts`:

```ts
expect(navItems).toMatchObject({
  name: 'navItems',
  label: 'Navigation Items',
  labels: { singular: 'Navigation Item', plural: 'Navigation Items' },
  maxRows: 8,
})

expect(navigationType).toMatchObject({
  name: 'navigationType',
  type: 'radio',
  required: true,
  defaultValue: 'directLink',
  admin: { layout: 'horizontal' },
})

expect(directLink).toMatchObject({ name: 'link', type: 'group' })
expect(directLink.fields.some((field) => 'name' in field && field.name === 'link')).toBe(false)

expect(descriptionLinks).toMatchObject({
  label: 'Description Links',
  labels: { singular: 'Description Link', plural: 'Description Links' },
  maxRows: 3,
})

expect(dropdownItems).toMatchObject({
  label: 'Dropdown Items',
  labels: { singular: 'Dropdown Item', plural: 'Dropdown Items' },
  required: true,
  minRows: 1,
  maxRows: 12,
})

expect(itemType).toMatchObject({
  type: 'radio',
  required: true,
  defaultValue: 'default',
  admin: { layout: 'horizontal' },
})
```

Also assert Featured `links` has zero-to-four semantics and `label: 'Navigation Links'`; List `links` is required with `minRows: 1`, `maxRows: 8`; Featured Rich Text remains stored as `label` but displays `Content`.

- [ ] **Step 2: Run the Header schema tests and verify failure**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-navigation.int.spec.ts
```

Expected: FAIL on Select types, nested Direct Link, missing labels, or missing bounds.

- [ ] **Step 3: Implement configuration-only field changes**

In `navigationItems.ts`, build the Direct Link directly with factory overrides:

```ts
link({
  appearances: false,
  disableLabel: true,
  relationTo: headerLinkTargets,
  urlOverrides: {
    hooks: { beforeChange: [trimText] },
    validate: validateNavigationURL,
  },
  overrides: {
    label: 'Direct Link',
    admin: {
      condition: (_, siblingData) =>
        siblingData?.navigationType === 'directLink' ||
        siblingData?.navigationType === 'directLinkAndDropdown',
    },
  },
})
```

Apply `trimText` and `validateNonBlankText` to Navigation Item Labels. Replace both Select discriminators with `type: 'radio'`, horizontal layout, and the approved defaults. Add the approved `label` and `labels` objects to every Array. Configure every labeled Header link with `labelOverrides` and every URL with `urlOverrides`; do not hard-code validators inside `link.ts`.

- [ ] **Step 4: Run the Header schema tests**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit the field model**

```bash
git add src/Header/fields/navigationItems.ts src/Header/fields/dropdown.ts src/Header/fields/dropdownItems.ts tests/int/header-navigation.int.spec.ts
git commit -m "refactor: finish header navigation fields"
```

## Task 3: Implement Pure Active-Branch Validation

**Files:**
- Modify: `src/Header/validators/validateNavigation.ts`
- Modify: `tests/int/header-navigation.int.spec.ts`

- [ ] **Step 1: Add failing table-driven validation tests**

Cover the approved cases with explicit inputs and expected messages:

```ts
expect(validateHeaderNavItems([
  { label: 'About', navigationType: 'directLink', link: reference('pages', 'p1') },
  { label: ' About ', navigationType: 'directLink', link: reference('pages', 'p2') },
])).toContain('Navigation Item 2')

expect(validateHeaderNavItems([
  { label: 'About', navigationType: 'directLink', link: reference('pages', 'p1') },
  { label: 'ABOUT', navigationType: 'directLink', link: reference('pages', 'p2') },
])).toBe(true)

expect(validateHeaderNavItems([
  { label: 'One', navigationType: 'directLink', link: reference('pages', 'p1') },
  { label: 'Two', navigationType: 'directLink', link: reference('pages', { id: 'p1' }) },
])).toContain('duplicate destination')
```

Add separate tests for:

- all three top-level types;
- blank normalized Label;
- raw and populated relationship IDs;
- case-sensitive trimmed Custom URLs;
- duplicate targets across top-level Direct Links;
- the combined per-Dropdown duplicate scope;
- reuse across different Dropdowns;
- top-level landing target reused inside its own Dropdown;
- inactive stale branches ignored;
- Featured with zero Navigation Links accepted;
- List with zero Navigation Links rejected;
- one-to-eight List links accepted;
- Menu CTA excluded from this Array validator.

- [ ] **Step 2: Run the validator tests and verify failure**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-navigation.int.spec.ts
```

Expected: FAIL because the validator still reads `link.link` and lacks uniqueness rules.

- [ ] **Step 3: Replace the validator with small pure helpers**

Use explicit helpers and export only those useful to focused tests:

```ts
export const getDestinationKey = (link?: HeaderLinkValue | null): string | undefined => {
  if (link?.type === 'custom') {
    const url = link.url?.trim()
    return url ? `custom:${url}` : undefined
  }

  if (link?.type !== 'reference' || !link.reference?.relationTo) return undefined
  const raw = link.reference.value
  const id =
    typeof raw === 'string' || typeof raw === 'number'
      ? raw
      : raw && typeof raw === 'object' && 'id' in raw
        ? (raw as { id?: unknown }).id
        : undefined

  return typeof id === 'string' || typeof id === 'number'
    ? `reference:${link.reference.relationTo}:${String(id)}`
    : undefined
}
```

Have `validateHeaderNavItems` perform these passes in order:

1. normalized nonblank and unique top-level Labels;
2. active-branch completeness;
3. unique active top-level Direct Link destinations;
4. one destination Set per active Dropdown, populated from all approved nested sources.

Return the first actionable error with one-based locations. Do not mutate data and do not traverse inactive branches.

- [ ] **Step 4: Run the validator tests**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 5: Commit validation**

```bash
git add src/Header/validators/validateNavigation.ts tests/int/header-navigation.int.spec.ts
git commit -m "feat: validate header navigation integrity"
```

## Task 4: Add Optional CTA, Access, and Header Normalization

**Files:**
- Create: `src/Header/hooks/normalizeHeader.ts`
- Modify: `src/Header/config.ts`
- Create: `tests/int/header-normalization.int.spec.ts`
- Modify: `tests/int/header-navigation.int.spec.ts`

- [ ] **Step 1: Write failing Global and normalization tests**

Assert authenticated updates, the CTA toggle, CTA condition, and hook order:

```ts
expect(Header.access?.update?.({ req: { user: null } } as never)).toBe(false)
expect(Header.access?.update?.({ req: { user: { id: 'u1' } } } as never)).toBe(true)
expect(enableMenuCta).toMatchObject({
  name: 'enableMenuCta',
  type: 'checkbox',
  defaultValue: false,
  label: 'Enable Menu CTA Button',
})
expect(menuCta.admin?.condition?.({}, { enableMenuCta: false } as never, {} as never)).toBe(false)
expect(menuCta.admin?.condition?.({}, { enableMenuCta: true } as never, {} as never)).toBe(true)
expect(Header.hooks?.beforeValidate).toEqual([normalizeHeader])
```

In `header-normalization.int.spec.ts`, pass a complete object containing active and inactive branches and assert Labels, Tags, Link Labels, and URLs are trimmed while Description, Content, case, and internal whitespace are preserved. Assert that the hook returns a normalized copy and does not mutate the input object.

- [ ] **Step 2: Run tests and verify failure**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-navigation.int.spec.ts tests/int/header-normalization.int.spec.ts
```

Expected: FAIL because the toggle and normalization hook do not exist.

- [ ] **Step 3: Implement the normalization hook**

Create a typed recursive traversal dedicated to the known Header shape. Use a small `normalizeLink` helper:

```ts
const normalizeLink = <T extends LinkLike | null | undefined>(link: T): T => {
  if (!link) return link
  return {
    ...link,
    ...(typeof link.label === 'string' ? { label: link.label.trim() } : {}),
    ...(typeof link.url === 'string' ? { url: link.url.trim() } : {}),
  } as T
}
```

Return a new Header data object. Traverse top-level links, CTA, Description Links, every Default link, every Featured/List Landing Link, and every nested Navigation Link, including inactive branches. Trim Navigation Labels and Tags. Leave Description and Rich Text untouched.

- [ ] **Step 4: Configure access, CTA, and hook order**

In `src/Header/config.ts`:

```ts
access: {
  read: () => true,
  update: authenticated,
},
fields: [
  navigationItems(),
  {
    name: 'enableMenuCta',
    type: 'checkbox',
    defaultValue: false,
    label: 'Enable Menu CTA Button',
  },
  link({
    appearances: false,
    labelOverrides: {
      hooks: { beforeChange: [trimText] },
      validate: validateNonBlankText,
    },
    relationTo: headerLinkTargets,
    urlOverrides: {
      hooks: { beforeChange: [trimText] },
      validate: validateNavigationURL,
    },
    overrides: {
      name: 'menuCta',
      label: 'Menu CTA Button',
      admin: { condition: (_, siblingData) => siblingData?.enableMenuCta === true },
    },
  }),
],
hooks: {
  beforeValidate: [normalizeHeader],
  afterChange: [revalidateHeader],
},
```

Keep the existing required flags inside the CTA link. Payload 4's installed field traversal skips validation when the configured `admin.condition` is false, so the same condition makes disabled CTA data optional for Admin, REST, GraphQL, and Local API writes. Add explicit Local API-shaped unit coverage for both condition results; do not add a second CTA validator.

- [ ] **Step 5: Run Header tests**

Run the command from Step 2.

Expected: PASS.

- [ ] **Step 6: Commit Global behavior**

```bash
git add src/Header/config.ts src/Header/hooks/normalizeHeader.ts tests/int/header-navigation.int.spec.ts tests/int/header-normalization.int.spec.ts
git commit -m "feat: finish header global behavior"
```

## Task 5: Finish Row Labels and Native Array Behavior Coverage

**Files:**
- Modify: `src/Header/RowLabel.tsx`
- Modify: `src/Header/DropdownItemRowLabel.tsx`
- Create: `tests/int/header-admin.int.spec.tsx`

- [ ] **Step 1: Write failing Row Label tests**

Mock `useRowLabel` and render each case:

```ts
expect(renderNavRow({ label: ' Products ', navigationType: 'dropdown' }, 0))
  .toContain('Navigation Item 1: Products · Dropdown')
expect(renderDropdownRow({ type: 'default', defaultItem: { link: { label: ' Docs ' } } }, 0))
  .toContain('Dropdown Item 1: Docs · Default')
expect(renderDropdownRow({ type: 'featured', featuredItem: { tag: ' Featured ' } }, 1))
  .toContain('Dropdown Item 2: Featured · Featured')
```

Also prove stale inactive values never win over the selected type and empty rows use deterministic numbered fallbacks.

- [ ] **Step 2: Run the test and verify failure**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-admin.int.spec.tsx
```

Expected: FAIL on current wording or active-branch selection.

- [ ] **Step 3: Implement presentation-only summaries**

Keep components free of mutation and validation. Compute labels from the discriminator first:

```ts
const activeLabel =
  data?.type === 'default'
    ? data.defaultItem?.link?.label
    : data?.type === 'featured'
      ? data.featuredItem?.tag
      : data?.type === 'list'
        ? data.listItem?.tag
        : undefined
```

Use `Navigation Item N` and `Dropdown Item N` consistently with configured Array singular labels.

- [ ] **Step 4: Run Row Label and Header tests**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-admin.int.spec.tsx tests/int/header-navigation.int.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Row Label polish**

```bash
git add src/Header/RowLabel.tsx src/Header/DropdownItemRowLabel.tsx tests/int/header-admin.int.spec.tsx
git commit -m "feat: clarify header row summaries"
```

## Task 6: Regenerate Schema Artifacts and Run Focused Verification

**Files:**
- Modify: `src/payload-types.ts`
- Modify: `src/app/(payload)/admin/importMap.js`

- [ ] **Step 1: Read the installed framework guidance before generation**

Because this repository uses a nonstandard Next.js release, locate and read the relevant local Admin/build guide under the installed `node_modules/next/dist/docs/` before running generated-code commands. Follow any deprecation notices; do not rely on remembered Next.js conventions.

- [ ] **Step 2: Generate Payload types**

```bash
corepack pnpm run generate:types
```

Expected: exit 0. Confirm `HeaderNavItem.link` is single-level, `navigationType` values are unchanged, `enableMenuCta` exists, and generated Dropdown bounds do not introduce unexpected schema fields.

- [ ] **Step 3: Generate the Admin import map**

```bash
corepack pnpm run generate:importmap
```

Expected: exit 0. Only required Header component mappings plus concurrent already-valid mappings remain.

- [ ] **Step 4: Run focused integration tests**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/header-link-factory.int.spec.ts \
  tests/int/header-navigation.int.spec.ts \
  tests/int/header-normalization.int.spec.ts \
  tests/int/header-admin.int.spec.tsx \
  tests/int/footer-config.int.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Run generated-artifact and source checks**

```bash
git diff --check
corepack pnpm exec tsc --noEmit
```

Expected: `git diff --check` passes. TypeScript passes, or any failure is documented with exact evidence as pre-existing/out-of-scope; do not attribute concurrent Social or frontend failures to Header.

- [ ] **Step 6: Commit generated artifacts**

Stage only Header-related generated hunks if another task has concurrent generated changes:

```bash
git add src/payload-types.ts src/app/'(payload)'/admin/importMap.js
git commit -m "chore: regenerate header schema artifacts"
```

Before committing, inspect `git diff --cached` and unstage any unrelated Social or Footer hunk.

## Task 7: Clear Only the Current Development Header Data

**Files:**
- Create temporarily: `scripts/clear-development-header.ts`
- Test: `tests/int/header-navigation.int.spec.ts`

- [ ] **Step 1: Confirm the exact development target read-only**

Inspect the resolved environment without printing secrets. Confirm the database host is local and the database name is `ecolitea2`. Abort if it points at a remote host or an unexpected database.

- [ ] **Step 2: Create a narrowly scoped Payload Local API script**

Implement an explicit script that initializes Payload from `src/payload.config.ts`, reads `header`, logs only whether the three target fields contain data, then updates exactly:

```ts
await payload.updateGlobal({
  slug: 'header',
  data: {
    navItems: [],
    enableMenuCta: false,
    menuCta: null,
  },
  context: { disableRevalidate: true },
})
```

If generated types reject `null`, use the empty value generated for `menuCta`; do not broaden the update with unrelated fields.

- [ ] **Step 3: Run the reset once**

```bash
corepack pnpm exec tsx scripts/clear-development-header.ts
```

Expected: the script reports the local target, updates only the Header Global, and exits 0. This destructive step is already authorized for current Header content, but must still abort on any target mismatch.

- [ ] **Step 4: Verify the empty Header through Payload**

Read the Header Global again and assert:

```ts
expect(header.navItems ?? []).toEqual([])
expect(header.enableMenuCta).toBe(false)
expect(header.menuCta == null || Object.keys(header.menuCta).length === 0).toBe(true)
```

Also confirm Footer and Site Settings documents were not updated by comparing their IDs or `updatedAt` values captured before the reset.

- [ ] **Step 5: Remove the one-time script**

Delete `scripts/clear-development-header.ts` after successful verification so a destructive maintenance command is not shipped as product code.

- [ ] **Step 6: Run the final focused suite**

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/header-link-factory.int.spec.ts \
  tests/int/header-navigation.int.spec.ts \
  tests/int/header-normalization.int.spec.ts \
  tests/int/header-admin.int.spec.tsx \
  tests/int/footer-config.int.spec.ts
git diff --check
```

Expected: all tests pass and the diff check is clean.

- [ ] **Step 7: Review and commit the completed Header work**

Inspect the entire branch state and stage only Header-owned work plus the intentional shared validation refactor and generated Header hunks:

```bash
git status --short
git diff --check
git diff --cached
git commit -m "feat: finish header admin configuration"
```

Do not commit the temporary reset script, database files, Social work, Footer work already owned by another commit, or frontend Header adaptations.

## Completion Checklist

- [ ] Header reads remain public and updates require authentication.
- [ ] Both three-state controls are native horizontal Radio fields with approved defaults.
- [ ] Direct Link is stored at `navigationItem.link`, never `navigationItem.link.link`.
- [ ] Required markers match active conditional requirements; Description and Content remain optional.
- [ ] Menu CTA is explicitly enabled or disabled and disabled content is ignored.
- [ ] Array labels and bounds match the design.
- [ ] Strings are trimmed without changing case or internal whitespace.
- [ ] Header and Footer opt into one shared URL validator; unrelated links retain existing behavior.
- [ ] Label and destination duplicate scopes match the design exactly.
- [ ] Inactive values remain recoverable and do not influence validation or Row Labels.
- [ ] Native Array actions remain available and invalid resulting states cannot save.
- [ ] Generated types and import map match the final schema.
- [ ] Only current local Header data was cleared, and the reset script was removed.
- [ ] No frontend adaptation or unrelated concurrent work was included.
