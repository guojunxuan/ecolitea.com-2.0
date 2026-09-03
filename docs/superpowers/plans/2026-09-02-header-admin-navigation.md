# Header Admin Navigation Implementation Plan

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the Payload `header` Global from a flat list of links into a reusable, enterprise-grade navigation model. Editors can manage up to eight sortable top-level navigation items, each behaving as a direct link, a dropdown trigger, or both, with dropdowns that freely mix `default`, `featured`, and `list` item types, plus a global menu CTA. The Admin-facing data model and editing experience change; the production frontend Header renderer stays visually unchanged except for a minimal type-compatibility shim required to keep `tsc` green.

**Architecture:** Keep the Global slug and Admin label `header`/`Header`. Preserve the official Payload template skeleton — a `navItems` Array of rows built from the shared `link()` field factory — and extend each row with a `navigationType` select and a conditional dropdown structure. All field configuration is declarative and assembled from small modules under `src/Header/`; only two thin client RowLabel components and a focused cross-field validator are custom code. The existing `revalidateHeader` after-change hook is retained unchanged. The shared `link()` factory gains an optional `relationTo` parameter so Header links can target Pages, Posts, Case Studies, and Categories without widening the choices that Footer and page fields already receive.

**Tech Stack:** Payload CMS 4 canary, Next.js 16 App Router, React 19, TypeScript 6, MongoDB, Vitest, Testing Library, Playwright.

---

## File Structure

- Modify `src/Header/config.ts`: reassemble the Global from the new field modules; keep it a thin assembly point.
- Create `src/Header/fields/navigationItems.ts`: top-level `navItems` Array (`HeaderNavItem`), rows of `label`, `navigationType`, direct-link, and conditional dropdown.
- Create `src/Header/fields/dropdown.ts`: conditional dropdown group with `description`, `descriptionLinks`, and the `items` Array.
- Create `src/Header/fields/dropdownItems.ts`: the mixed `default` / `featured` / `list` item configuration (`HeaderDropdownItem`).
- Create `src/Header/validators/validateNavigation.ts`: pure cross-field business validation covering both Admin and server-side APIs.
- Modify `src/Header/RowLabel.tsx`: top-level row summary from `label` + `navigationType`.
- Create `src/Header/DropdownItemRowLabel.tsx`: dropdown-row summary from item `type` + best available label/tag.
- Modify `src/fields/link.ts`: add optional `relationTo` parameter, defaulting to the current Pages + Posts targets.
- Modify `src/Header/Nav/index.tsx`: minimal compatibility shim so the new data shape renders without breaking `tsc` or runtime.
- Modify `src/endpoints/seed/index.ts`: migrate the existing flat seed Header rows into `navigationType`-aware rows.
- Modify `src/payload.config.ts` (no change expected): confirm `Header` Global registration remains intact after refactor.
- Regenerate `src/payload-types.ts` and `src/app/(payload)/admin/importMap.js`.

### Existing files that MUST remain without unrelated changes

The following are outside this task's scope and must not be modified: Footer module (`src/Footer/**`), Site Settings module (`src/SiteSettings/**`), all Collections other than what seeded Header data references, the `link()` field factory's default behavior for non-Header consumers, and the frontend Header layout/styling.

---

### Task 0: Confirm workspace baseline

**Files:** none.

- [ ] **Step 1: Verify the current branch and worktree**

Run inside `/Users/jason/ecolitea.com 2.0/.worktrees/codex-site-settings`:

```bash
git branch --show-current
# confirm: codex/site-settings

git status --short
# note existing unrelated modified/untracked files; do NOT touch them.

git worktree list --porcelain
# confirm the Site Settings worktree is the active one.
```

- [ ] **Step 2: Confirm the current Header schema loads**

Run the tests currently exercising the Header or a global smoke check, then record the baseline is green before any change:

```bash
corepack pnpm test:int -- tests/int
```

If the broad suite is flaky, at minimum run the existing config tests that exercise `Header` through the seed endpoint or a targeted global test. Record which pass/fail before editing.

---

### Task 1: Extend the shared `link()` field factory

**Files:**
- Modify: `src/fields/link.ts`
- Test: `tests/int/header-navigation.int.spec.ts` (created in Task 2; the link assertions live there but are written first)

The factory must keep its current default behavior for every existing consumer. Header links explicitly expand their `relationTo` without affecting Footer or page-level links.

- [ ] **Step 1: Update the `LinkType` signature**

Add an optional `relationTo` parameter. Keep the existing parameters and their defaults exactly as they are today.

```ts
type LinkType = (options?: {
  appearances?: LinkAppearances[] | false
  disableLabel?: boolean
  overrides?: Partial<GroupField>
  relationTo?: CollectionSlug | CollectionSlug[]
}) => Field
```

Ensure the default `relationTo` for the `reference` field stays `['pages', 'posts']` when the caller does not pass `relationTo`.

- [ ] **Step 2: Apply `relationTo` to the reference relationship field**

Use the `relationTo` option when present; otherwise fall back to the existing `['pages', 'posts']`. Set this in the `linkTypes` array construction, **not** via `overrides` — because `deepMerge` treats arrays as wholesale replacements, an `overrides` merge would fail to reach the nested `fields[].reference.relationTo`. The factory reads the option directly at construction time:

```ts
const linkTypes: Field[] = [
  {
    name: 'reference',
    type: 'relationship',
    admin: {
      condition: (_, siblingData) => siblingData?.type === 'reference',
    },
    label: 'Document to link to',
    relationTo: relationTo ?? ['pages', 'posts'],
    required: true,
  },
  // ... `url` field unchanged
]
```

This also means the Header field module passes `relationTo` as a **direct factory option**, not as an `overrides` entry, for every Header `link()` call.

- [ ] **Step 3: Guard the field factory import for the Header relationTo type**

The `relationTo` value passes through to a Payload `relationship` field, which accepts the same `CollectionSlug` type used elsewhere. Confirm `CollectionSlug` is importable from `payload` without a circular import, or use `Parameters<typeof RelationshipField>`-style extraction if the project already does so. Prefer the simplest option the codebase already uses.

- [ ] **Step 4: Verify no existing `link()` call regressed**

Only the default no-argument path and existing `link({ appearances, disableLabel, overrides })` calls may remain. Run the footer config test after `generate:types` to confirm the default targets are still Pages + Posts:

```bash
corepack pnpm test:int -- tests/int/footer-config.int.spec.ts
```

---

### Task 2: Build the `navItems` Array (top-level navigation)

**Files:**
- Create: `src/Header/fields/navigationItems.ts`
- Test: `tests/int/header-navigation.int.spec.ts`

Define the top-level Array. It preserves the official vocabulary (`navItems`, `maxRows`, `initCollapsed`, `RowLabel`) and adds the `navigationType` select plus conditional direct-link/dropdown groups.

- [ ] **Step 1: Write the failing top-level config test**

Assert the top-level `navItems` Array has the expected identity, interface name, row limit, default collapse, RowLabel path, and required fields:

```ts
// tests/int/header-navigation.int.spec.ts
import { describe, expect, it } from 'vitest'
import { Header } from '@/Header/config'
import { navigationItems } from '@/Header/fields/navigationItems'

describe('Header navigationItems field', () => {
  it('defines a sortable, collapsed, maxRows-8 navigation array', () => {
    const items = navigationItems()
    expect(items).toMatchObject({
      name: 'navItems',
      type: 'array',
      maxRows: 8,
      interfaceName: 'HeaderNavItem',
      admin: {
        initCollapsed: true,
        components: { RowLabel: '@/Header/RowLabel#RowLabel' },
      },
    })
  })

  it('binds a required label and required navigation type to each row', () => {
    const fields = navigationItems().fields
    expect(fields).toContainEqual(expect.objectContaining({ name: 'label', type: 'text', required: true }))
    expect(fields).toContainEqual(
      expect.objectContaining({
        name: 'navigationType',
        type: 'select',
        required: true,
        options: [
          { label: 'Direct Link', value: 'directLink' },
          { label: 'Dropdown', value: 'dropdown' },
          { label: 'Direct Link + Dropdown', value: 'directLinkAndDropdown' },
        ],
      }),
    )
  })
})
```

- [ ] **Step 2: Confirm the test is RED**

Run:

```bash
corepack pnpm test:int -- tests/int/header-navigation.int.spec.ts
```

Expect failure because `@/Header/fields/navigationItems` does not exist yet.

- [ ] **Step 3: Create `src/Header/fields/navigationItems.ts`**

```ts
import type { ArrayField } from 'payload'
import { link } from '@/fields/link'

export const navigationItems = (): ArrayField => ({
  name: 'navItems',
  type: 'array',
  maxRows: 8,
  interfaceName: 'HeaderNavItem',
  admin: {
    initCollapsed: true,
    components: {
      RowLabel: '@/Header/RowLabel#RowLabel',
    },
  },
  fields: [
    { name: 'label', type: 'text', required: true },
    {
      name: 'navigationType',
      type: 'select',
      required: true,
      defaultValue: 'directLink',
      options: [
        { label: 'Direct Link', value: 'directLink' },
        { label: 'Dropdown', value: 'dropdown' },
        { label: 'Direct Link + Dropdown', value: 'directLinkAndDropdown' },
      ],
    },
    // Direct Link group, shown for directLink and directLinkAndDropdown
    {
      name: 'link',
      type: 'group',
      admin: {
        condition: (_, siblingData) =>
          siblingData?.navigationType === 'directLink' ||
          siblingData?.navigationType === 'directLinkAndDropdown',
      },
      fields: [
        link({
          appearances: false,
          disableLabel: true,
          relationTo: ['pages', 'posts', 'case-studies', 'categories'],
        }),
      ],
    },
    // Dropdown group, shown for dropdown and directLinkAndDropdown
    // Filled in by src/Header/fields/dropdown.ts (deferred to Task 3)
  ],
})
```

- [ ] **Step 4: Confirm the test is GREEN**

Run `tests/int/header-navigation.int.spec.ts`. It should pass for the top-level assertions. The dropdown subfields are not yet asserted here; they come in Task 3.

---

### Task 3: Build the Dropdown structure

**Files:**
- Create: `src/Header/fields/dropdown.ts`
- Test: `tests/int/header-navigation.int.spec.ts`

- [ ] **Step 1: Add a failing dropdown config test**

Assert the conditional dropdown group exposes `description`, `descriptionLinks`, and a required `items` Array, and that the group is conditional on the dropdown navigation types:

```ts
it('exposes dropdown fields only for dropdown navigation types', () => {
  const items = navigationItems()
  const dropdown = items.fields.find(
    (f) => 'name' in f && f.name === 'dropdown',
  )
  expect(dropdown).toMatchObject({
    name: 'dropdown',
    type: 'collapsible' /* or group, matching the chosen presentation */,
    admin: {
      condition: expect.any(Function),
    },
  })

  const sub = dropdown && 'fields' in dropdown ? dropdown.fields : []
  expect(sub).toContainEqual(expect.objectContaining({ name: 'description', type: 'textarea' }))
  expect(sub.find((f) => 'name' in f && f.name === 'descriptionLinks')).toBeTruthy()
  expect(sub.find((f) => 'name' in f && f.name === 'items')).toMatchObject({
    type: 'array',
    required: true,
    minRows: 1,
    interfaceName: 'HeaderDropdownItem',
  })
})
```

- [ ] **Step 2: Confirm RED**

Run the Header nav test. Expect failure because the dropdown field is not yet present.

- [ ] **Step 3: Create `src/Header/fields/dropdown.ts`**

```ts
import type { CollapsibleField, GroupField } from 'payload'
import { link } from '@/fields/link'

export const dropdown = (): GroupField => ({
  name: 'dropdown',
  type: 'group',
  admin: {
    condition: (_, siblingData) =>
      siblingData?.navigationType === 'dropdown' ||
      siblingData?.navigationType === 'directLinkAndDropdown',
  },
  fields: [
    { name: 'description', type: 'textarea', label: 'Description' },
    {
      name: 'descriptionLinks',
      type: 'array',
      label: 'Description links',
      fields: [link({ appearances: false, relationTo: ['pages', 'posts', 'case-studies', 'categories'] })],
    },
    // `items` Array — filled by src/Header/fields/dropdownItems.ts
  ],
})
```

The presentation wrapper must not introduce an unnecessary stored object solely for Admin layout. Choose `group` or `collapsible` to match the project's existing convention (the Footer and SiteSettings modules already use groups; the old project used collapsible sections). Keep this decision consistent with `navigationItems.ts`.

- [ ] **Step 4: Confirm the test is GREEN**

Run the Header nav tests; the dropdown presence assertions should pass. The `items` Array subfields are covered in Task 4.

---

### Task 4: Build mixed Dropdown Item types

**Files:**
- Create: `src/Header/fields/dropdownItems.ts`
- Test: `tests/int/header-navigation.int.spec.ts`

Define the `HeaderDropdownItem` Array. It holds a required `type` select (`default`, `featured`, `list`) and conditionally renders only the matching configuration group. Each type may appear in any order and freely mixed.

- [ ] **Step 1: Write the failing dropdown-items config test**

Assert the items Array, its RowLabel path, and that all three type groups exist with the correct conditional logic and required fields:

```ts
it('defines a sortable items array with mixed default/featured/list types', () => {
  const items = navigationItems()
  const dropdown = items.fields.find((f) => 'name' in f && f.name === 'dropdown')
  const itemsArray = dropdown?.fields?.find((f) => 'name' in f && f.name === 'items')

  expect(itemsArray).toMatchObject({
    name: 'items',
    type: 'array',
    required: true,
    minRows: 1,
    interfaceName: 'HeaderDropdownItem',
    admin: {
      initCollapsed: true,
      components: { RowLabel: '@/Header/DropdownItemRowLabel#DropdownItemRowLabel' },
    },
  })

  const subFields = itemsArray?.fields ?? []
  expect(subFields.some((f) => 'name' in f && f.name === 'type')).toBe(true)

  // default group
  const defaultGroup = subFields.find((f) => 'name' in f && f.name === 'defaultItem')
  expect(defaultGroup && 'fields' in defaultGroup ? defaultGroup.fields : []).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'link', type: 'group' }),
      expect.objectContaining({ name: 'description', type: 'textarea' }),
    ]),
  )

  // featured group
  const featuredGroup = subFields.find((f) => 'name' in f && f.name === 'featuredItem')
  const featuredFields = featuredGroup && 'fields' in featuredGroup ? featuredGroup.fields : []
  expect(featuredFields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'tag', type: 'text', required: true }),
      expect.objectContaining({ name: 'landingLink', type: 'group' }),
    ]),
  )

  // list group
  const listGroup = subFields.find((f) => 'name' in f && f.name === 'listItem')
  const listFields = listGroup && 'fields' in listGroup ? listGroup.fields : []
  expect(listFields).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'tag', type: 'text', required: true }),
      expect.objectContaining({ name: 'landingLink', type: 'group' }),
    ]),
  )
})
```

- [ ] **Step 2: Confirm RED**

Run the Header nav tests. Expect failure because `items` is not yet defined with the three type groups.

- [ ] **Step 3: Create `src/Header/fields/dropdownItems.ts`**

```ts
import type { ArrayField } from 'payload'
import { link } from '@/fields/link'

const headerLinkTargets = ['pages', 'posts', 'case-studies', 'categories'] as const

export const dropdownItems = (): ArrayField => ({
  name: 'items',
  type: 'array',
  required: true,
  minRows: 1,
  maxRows: 12,
  interfaceName: 'HeaderDropdownItem',
  admin: {
    initCollapsed: true,
    components: {
      RowLabel: '@/Header/DropdownItemRowLabel#DropdownItemRowLabel',
    },
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Featured', value: 'featured' },
        { label: 'List', value: 'list' },
      ],
    },
    {
      name: 'defaultItem',
      type: 'group',
      admin: { condition: (_, siblingData) => siblingData?.type === 'default' },
      fields: [
        link({ appearances: false, relationTo: [...headerLinkTargets] }),
        { name: 'description', type: 'textarea' },
      ],
    },
    {
      name: 'featuredItem',
      type: 'group',
      admin: { condition: (_, siblingData) => siblingData?.type === 'featured' },
      fields: [
        { name: 'tag', type: 'text', required: true },
        link({
          appearances: false,
          disableLabel: true,
          relationTo: [...headerLinkTargets],
          overrides: { name: 'landingLink', label: 'Landing Link' },
        }),
        { name: 'label', type: 'richText' },
        {
          name: 'links',
          type: 'array',
          fields: [link({ appearances: false, relationTo: [...headerLinkTargets] })],
        },
      ],
    },
    {
      name: 'listItem',
      type: 'group',
      admin: { condition: (_, siblingData) => siblingData?.type === 'list' },
      fields: [
        { name: 'tag', type: 'text', required: true },
        link({
          appearances: false,
          disableLabel: true,
          relationTo: [...headerLinkTargets],
          overrides: { name: 'landingLink', label: 'Landing Link' },
        }),
        {
          name: 'links',
          type: 'array',
          fields: [link({ appearances: false, relationTo: [...headerLinkTargets] })],
        },
      ],
    },
  ],
})
```

- [ ] **Step 4: Complete the dropdown group by embedding `dropdownItems`**

In `src/Header/fields/dropdown.ts`, append the return value of `dropdownItems()` to the group's `fields` array so the items array is part of the conditional dropdown group.

- [ ] **Step 5: Confirm the test is GREEN**

Run the Header nav tests; the items-array assertions should now pass.

---

### Task 5: Reinstate the top-level `link()` in `navigationItems` for each applicable type

**Files:**
- Modify: `src/Header/fields/navigationItems.ts`

The Direct Link group was sketched in Task 2; make sure it is actually wired to `link()` with `disableLabel: true` and Header field targets, and that it appears for `directLink` and `directLinkAndDropdown`. Confirm the group is not shown for `dropdown`-only rows.

- [ ] **Step 1: Add a conditional-field test**

```ts
it('shows the direct link only for link-capable navigation types', () => {
  const items = navigationItems()
  const group = items.fields.find((f) => 'name' in f && f.name === 'link')
  const cond = group?.admin?.condition
  expect(typeof cond).toBe('function')
  expect(cond?.({}, { navigationType: 'directLink' })).toBe(true)
  expect(cond?.({}, { navigationType: 'directLinkAndDropdown' })).toBe(true)
  expect(cond?.({}, { navigationType: 'dropdown' })).toBe(false)
})
```

- [ ] **Step 2: Confirm the test is GREEN**

Run the Header nav tests to verify the `link` group's condition works for the three navigation types.

---

### Task 6: Add the menu CTA

**Files:**
- Modify: `src/Header/config.ts`
- Test: `tests/int/header-navigation.int.spec.ts`

- [ ] **Step 1: Add a failing menuCTA test**

```ts
it('keeps a global menu CTA outside the navigation array', () => {
  const fields = Header.fields
  const cta = fields.find((f) => 'name' in f && f.name === 'menuCta')
  expect(cta).toBeTruthy()
  const ctaFields = cta && 'fields' in cta ? cta.fields : []
  expect(ctaFields.some((f) => 'name' in f && f.name === 'appearance')).toBe(false)
})
```

- [ ] **Step 2: Confirm RED**

Run the Header nav tests; expect failure because `menuCta` is not yet added to the Global.

- [ ] **Step 3: Add `menuCta` to `config.ts`**

In `src/Header/config.ts`, alongside `navItems`:

```ts
link({
  appearances: false,
  relationTo: ['pages', 'posts', 'case-studies', 'categories'],
  overrides: { name: 'menuCta', label: 'Menu CTA Button' },
})
```

- [ ] **Step 4: Confirm the test is GREEN**

Run the Header nav tests; the CTA assertion should pass.

---

### Task 7: Write the cross-field business validator

**Files:**
- Create: `src/Header/validators/validateNavigation.ts`
- Test: `tests/int/header-navigation.int.spec.ts`

The validator handles only business rules that Payload's built-in field validation cannot express. Validation must resolve server-side for Admin, REST, GraphQL, and Local API.

- [ ] **Step 1: Write the failing validator test**

```ts
import { validateHeaderNavItems } from '@/Header/validators/validateNavigation'

describe('validateHeaderNavItems', () => {
  const baseLink = { type: 'reference', reference: { relationTo: 'pages', value: 'abc' } }
  const direct = { label: 'About', navigationType: 'directLink', link: baseLink }
  const dropdownOnly = {
    label: 'Solutions',
    navigationType: 'dropdown',
    dropdown: { items: [{ type: 'default', defaultItem: { link: baseLink } }] },
  }

  it('accepts a valid direct link', () => {
    expect(validateHeaderNavItems([direct])).toBe(true)
  })

  it('accepts a valid dropdown-only item', () => {
    expect(validateHeaderNavItems([dropdownOnly])).toBe(true)
  })

  it('accepts a valid hybrid with both link and items', () => {
    const hybrid = { label: 'Company', navigationType: 'directLinkAndDropdown', link: baseLink,
      dropdown: { items: [{ type: 'default', defaultItem: { link: baseLink } }] } }
    expect(validateHeaderNavItems([hybrid])).toBe(true)
  })

  it('rejects a directLink without a valid link', () => {
    const bad = { ...direct, link: undefined }
    expect(validateHeaderNavItems([bad])).toEqual(expect.stringContaining('Direct Link'))
  })

  it('rejects a dropdown with no items', () => {
    const bad = { ...dropdownOnly, dropdown: { items: [] } }
    expect(validateHeaderNavItems([bad])).toEqual(expect.stringContaining('item'))
  })

  it('rejects a hybrid missing its direct link', () => {
    const bad = { label: 'Company', navigationType: 'directLinkAndDropdown',
      dropdown: { items: [{ type: 'default', defaultItem: { link: baseLink } }] } }
    expect(validateHeaderNavItems([bad])).toEqual(expect.stringContaining('Direct Link'))
  })

  it('rejects a featured item missing its tag', () => {
    const bad = { label: 'Solutions', navigationType: 'dropdown',
      dropdown: { items: [{ type: 'featured', featuredItem: { landingLink: baseLink } }] } }
    expect(validateHeaderNavItems([bad])).toEqual(expect.stringContaining('tag'))
  })

  it('rejects a list item missing its landing link', () => {
    const bad = { label: 'Solutions', navigationType: 'dropdown',
      dropdown: { items: [{ type: 'list', listItem: { tag: 'Resources' } }] } }
    expect(validateHeaderNavItems([bad])).toEqual(expect.stringContaining('Landing Link'))
  })

  it('ignores inactive conditional groups', () => {
    const bad = { label: 'About', navigationType: 'directLink', link: baseLink,
      dropdown: { items: [{ type: 'featured', featuredItem: {} }] } }
    // The stale dropdown data should NOT cause a failure because type is directLink.
    expect(validateHeaderNavItems([bad])).toBe(true)
  })
})
```

- [ ] **Step 2: Confirm RED**

Run the Header nav tests. Expect failure because `validateHeaderNavItems` does not exist.

- [ ] **Step 3: Create `src/Header/validators/validateNavigation.ts`**

Implement a pure, typed function `validateHeaderNavItems(items?)`. It:

- Iterates each top-level `HeaderNavItem`.
- For `directLink` and `directLinkAndDropdown`: require a `link` with a destination (`reference.value` or a non-empty `url`).
- For `dropdown` and `directLinkAndDropdown`: require at least one item in `dropdown.items`.
- For each dropdown item, resolve its active type group:
  - `default`: no extra required fields beyond the link's own validation.
  - `featured`: require non-empty `tag` and a valid `landingLink`.
  - `list`: require non-empty `tag` and a valid `landingLink`.
- Ignore inactive groups (do not validate fields belonging to a `type` other than the current row).
- Return `true` or a descriptive string that names the top-level label and, where relevant, the item type/tag, to help editors locate the problem.

Only validate the business rules the spec requires; do not mutate data or delete inactive values.

- [ ] **Step 4: Wire the validator to the Header Global**

In `src/Header/fields/navigationItems.ts`, attach the validator to the `navItems` Array via `validate: validateHeaderNavItems`.

- [ ] **Step 5: Confirm the test is GREEN**

Run the Header nav tests. The validator assertions should pass.

---

### Task 8: Build the two RowLabel components

**Files:**
- Modify: `src/Header/RowLabel.tsx`
- Create: `src/Header/DropdownItemRowLabel.tsx`
- Test: (covered by existing integration tests / manual import-map check)

- [ ] **Step 1: Update the top-level RowLabel**

Replace the current `link.label`-based summary with a summary based on the new fields:

```tsx
'use client'
import type { HeaderNavItem } from '@/payload-types'
import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

export const RowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<NonNullable<Header['navItems']>[number]>()
  const num = rowNumber === undefined ? '' : `Nav item ${rowNumber + 1}`
  const label = data?.label?.trim()
  const type = data?.navigationType
  const typeLabel = type ? ` · ${humanizeType(type)}` : ''

  return <div>{label ? `${num}: ${label}${typeLabel}` : `${num}: Row`}</div>
}
```

- [ ] **Step 2: Create the dropdown RowLabel**

```tsx
'use client'
import type { HeaderDropdownItem } from '@/payload-types'
import { RowLabelProps, useRowLabel } from '@payloadcms/ui'

export const DropdownItemRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<NonNullable<HeaderDropdownItem>['type'] extends never
    ? never
    : NonNullable<Header['navItems']>[number]['dropdown']['items'][number]>()
  const num = rowNumber === undefined ? '' : `Item ${rowNumber + 1}`
  const type = data?.type
  const label =
    (data?.defaultItem && data?.defaultItem?.link?.label) ||
    (data?.featuredItem && data?.featuredItem?.tag) ||
    (data?.listItem && data?.listItem?.tag) ||
    ''

  return <div>{label ? `${num}: ${label}` : `${num}: ${humanizeType(type)}`}</div>
}
```

Note: the exact typing here should be simplified once generated types exist; do not over-engineer. A pragmatic approach is to use a local `type DropdownRow = { type?: 'default'|'featured'|'list'|null; defaultItem?: {...}; featuredItem?: {...}; listItem?: {...} }` for the `useRowLabel` generic, matching `src/Footer/RowLabel.tsx`'s pragmatic style.

- [ ] **Step 3: Verify the components compile**

Run the type check and regenerate the import map so the RowLabel paths resolve in the Admin:

```bash
corepack pnpm generate:types
corepack pnpm generate:importmap
corepack pnpm build
```

---

### Task 9: Apply the minimal frontend compatibility shim

**Files:**
- Modify: `src/Header/Nav/index.tsx`

The production frontend Header renderer only needs to keep compiling and rendering the new data shape. It does not add dropdown layout, styling, or interaction. A dropdown-only item should render as a non-link placeholder or be omitted; a direct-link or hybrid item renders through `CMSLink`.

- [ ] **Step 1: Confirm the current frontend component fails type-check after `generate:types`**

Run the type check:

```bash
corepack pnpm tsc --noEmit
```

Confirm it reports errors in `src/Header/Nav/index.tsx` because `navItems[].link` is now optional.

- [ ] **Step 2: Apply the minimal shim**

Update `src/Header/Nav/index.tsx` so it filters to items that actually carry a `link`, and renders only those. Keep all styling and markup unchanged.

```tsx
'use client'
import React from 'react'
import type { Header as HeaderType } from '@/payload-types'
import { CMSLink } from '@/components/Link'
import Link from 'next/link'
import { SearchIcon } from 'lucide-react'

export const HeaderNav: React.FC<{ data: HeaderType }> = ({ data }) => {
  const navItems = data?.navItems || []

  return (
    <nav className="flex gap-3 items-center">
      {navItems.map((item, i) => {
        if (!item.link) return null
        return <CMSLink key={i} {...item.link} appearance="link" />
      })}
      <Link href="/search">
        <span className="sr-only">Search</span>
        <SearchIcon className="w-5 text-primary" />
      </Link>
    </nav>
  )
}
```

The change is minimal: it guards on `item.link` before spreading. Visual output for direct-link items is identical; dropdown-only items simply do not render until a later frontend task.

- [ ] **Step 3: Confirm type-check passes**

```bash
corepack pnpm tsc --noEmit
```

---

### Task 10: Migrate the seed data

**Files:**
- Modify: `src/endpoints/seed/index.ts`

The seed currently writes flat `navItems: [{ link: {...} }]`. Migrated rows must carry `label`, `navigationType`, and (for link rows) the `link` object. Dropdown-only rows can be added if desired, but at minimum the existing two rows become direct-link rows.

- [ ] **Step 1: Update the Header seed data**

```ts
navItems: [
  {
    label: 'Posts',
    navigationType: 'directLink',
    link: { type: 'custom', label: 'Posts', url: '/posts' },
  },
  {
    label: 'Contact',
    navigationType: 'directLink',
    link: { type: 'reference', label: 'Contact', reference: { relationTo: 'pages', value: contactPage.id } },
  },
],
```

Note: `label` moves to the top level of each row, and the `link` object keeps the destination and the display label. Since each row now has both a top-level `label` and a nested `link.label`, ensure the seed uses the correct fields — the top-level `label` is the menu name; the nested `link.label` may be omitted or kept identical. The `disableLabel: true` direct-link group means the nested `link.label` is not shown in the Admin, but it remains in the data shape for compatibility. For cleanliness, set the top-level `label` and omit or mirror the nested label.

- [ ] **Step 2: Update the header-clearing seed**

Hooks into the `globals.map(...)` `navItems: []` clearing; still valid because an empty array is a valid top-level state.

- [ ] **Step 3: Verify the seed still runs**

If the seed endpoint is invoked in tests or manually, confirm the migrated rows save and read back without error.

---

### Task 11: Regenerate Payload types and import map

**Files:**
- Modify: `src/payload-types.ts`
- Modify: `src/app/(payload)/admin/importMap.js`

- [ ] **Step 1: Regenerate types**

```bash
corepack pnpm generate:types
```

- [ ] **Step 2: Regenerate the import map**

```bash
corepack pnpm generate:importmap
```

- [ ] **Step 3: Confirm the Admin shell loads**

Run the dev server or the Admin-focused test and verify the Header Global page renders with the new fields without a schema error.

---

### Task 12: Run full verification

**Files:** all changed.

- [ ] **Step 1: Run the focused Header tests**

```bash
corepack pnpm test:int -- tests/int/header-navigation.int.spec.ts
```

- [ ] **Step 2: Run the related Footer config test to confirm no regression**

```bash
corepack pnpm test:int -- tests/int/footer-config.int.spec.ts
```

- [ ] **Step 3: Type-check and lint**

```bash
corepack pnpm tsc --noEmit
corepack pnpm lint
```

- [ ] **Step 4: Run the broader integration suite (where stable)**

```bash
corepack pnpm test:int
```

- [ ] **Step 5: Run the Admin e2e flow if available**

```bash
corepack pnpm test:e2e -- tests/e2e/admin.e2e.spec.ts
```

---

## Validation Rules (final)

The validator must enforce these across Admin and all server-side APIs:

1. `directLink` requires a valid Direct Link.
2. `dropdown` requires at least one Dropdown Item and does not require a Direct Link.
3. `directLinkAndDropdown` requires both a valid Direct Link and at least one Dropdown Item.
4. `default` validates only its active link and description fields.
5. `featured` requires a non-empty tag and a valid landing link.
6. `list` requires a non-empty tag and a valid landing link.
7. Inactive conditional groups must not cause validation failures.
8. Validation errors identify the top-level item and nested group when possible.

---

## Acceptance Criteria

- [ ] Editors can manage zero to eight ordered top-level navigation items.
- [ ] Each item explicitly supports Direct Link, Dropdown, or both.
- [ ] A Dropdown contains at least one item and freely mixes default, featured, and list types.
- [ ] Every link supports internal references and custom URLs.
- [ ] Header references can target Pages, Posts, Case Studies, and Categories without changing other link consumers.
- [ ] The CTA remains independently configurable.
- [ ] Invalid combinations cannot be saved through Admin or APIs.
- [ ] The implementation primarily uses Payload configuration and small isolated helpers.
- [ ] Existing Header identifiers and cache behavior remain compatible.
- [ ] Frontend Header layout and styling remain unchanged; only a compatibility shim keeps the existing renderer compiling against the new data shape.

## Explicitly Out of Scope

The following will NOT be changed in this task:

- Frontend dropdown layout, Megamenu rendering, navigation behavior, or responsive behavior.
- Any modification to Footer, Site Settings, Collections, or other modules.
- Any change to the default `link()` relationship targets for non-Header consumers.
- Any custom Payload Admin field editor or Global replacement view.
- Any schema migration beyond regenerated types (fields are additive; existing `navItems` data is migrated in the seed and preserved through the validator's lenient handling of inactive groups).
