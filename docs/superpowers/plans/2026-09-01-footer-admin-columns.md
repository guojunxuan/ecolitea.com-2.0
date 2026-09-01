# Footer Admin Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Payload Admin Footer global's flat navigation array with a grouped `columns → navItems → link` editor without changing frontend Footer rendering.

**Architecture:** The Footer global remains the owner of navigation content only and composes a reusable `navigationColumns()` field factory. The factory owns the nested Array structure, configurable bounds, shared `link()` composition, stable `interfaceName`, and generic Admin row labels. Payload types are regenerated immediately; the unchanged frontend's resulting `footer.navItems` type error is an accepted transition that the immediately following frontend Footer task will resolve.

**Tech Stack:** Payload CMS 4 canary, TypeScript 6, React 19, Vitest 4, Payload Admin custom row labels

---

## Scope Guard

Do not modify `src/Footer/Component.tsx`, `src/SiteSettings/**`, or `src/endpoints/seed/index.ts`.

Run `pnpm generate:types` after changing the schema. The generated removal of `Footer.navItems` and resulting frontend consumer error are explicitly accepted until the immediately following frontend Footer task.

## File Map

- Create `tests/int/footer-config.int.spec.ts`: focused contract tests for the Admin-only Footer schema.
- Create `src/fields/navigationColumns.ts`: reusable typed Array field factory with configurable bounds and component paths.
- Modify `src/Footer/RowLabel.tsx`: expose Footer-domain `ColumnRowLabel` and `NavItemRowLabel` components without generated-type coupling.
- Modify `src/Footer/config.ts`: compose the reusable field factory with Footer-specific limits.
- Modify `src/app/(payload)/admin/importMap.js`: generated registration for the two row-label components.
- Modify `src/payload-types.ts`: generated schema types, including `NavigationColumn`.
- Keep `src/Footer/Component.tsx` unchanged as an explicit scope assertion.

### Task 1: Specify the Footer Admin schema contract

**Files:**
- Create: `tests/int/footer-config.int.spec.ts`
- Read: `src/Footer/config.ts`
- Read: `src/Footer/hooks/revalidateFooter.ts`

- [ ] **Step 1: Write the failing schema tests**

Create `tests/int/footer-config.int.spec.ts` with:

```ts
import { describe, expect, it } from 'vitest'
import type { ArrayField, GroupField, TextField } from 'payload'

import { Footer } from '@/Footer/config'
import { revalidateFooter } from '@/Footer/hooks/revalidateFooter'

const getNamedField = (name: string) =>
  Footer.fields.find((field) => 'name' in field && field.name === name)

describe('Footer Global Admin schema', () => {
  it('owns grouped navigation only', () => {
    expect(Footer.slug).toBe('footer')
    expect(Footer.fields).toHaveLength(1)
    expect(getNamedField('navItems')).toBeUndefined()
    expect(getNamedField('columns')).toBeDefined()
    expect(Footer.hooks?.afterChange).toEqual([revalidateFooter])
    expect(Footer.versions).toBe(false)
  })

  it('defines one to four collapsed navigation columns', () => {
    const columns = getNamedField('columns') as ArrayField
    expect(columns).toMatchObject({
      type: 'array', required: true, minRows: 1, maxRows: 4,
      interfaceName: 'NavigationColumn',
      admin: {
        initCollapsed: true,
        components: { RowLabel: '@/Footer/RowLabel#ColumnRowLabel' },
      },
    })
    const label = columns.fields.find(
      (field): field is TextField =>
        'name' in field && field.name === 'label' && field.type === 'text',
    )
    expect(label).toMatchObject({ required: true })
  })

  it('defines one to eight collapsed shared links per column', () => {
    const columns = getNamedField('columns') as ArrayField
    const navItems = columns.fields.find(
      (field): field is ArrayField =>
        'name' in field && field.name === 'navItems' && field.type === 'array',
    )
    expect(navItems).toMatchObject({
      required: true, minRows: 1, maxRows: 8,
      admin: {
        initCollapsed: true,
        components: { RowLabel: '@/Footer/RowLabel#NavItemRowLabel' },
      },
    })
    const link = navItems?.fields.find(
      (field): field is GroupField =>
        'name' in field && field.name === 'link' && field.type === 'group',
    )
    expect(link).toBeDefined()
    expect(link?.fields.some((field) => 'name' in field && field.name === 'appearance')).toBe(false)
  })
})
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
pnpm exec vitest run tests/int/footer-config.int.spec.ts --config ./vitest.config.mts
```

Expected: FAIL because `Footer.fields` still exposes top-level `navItems` and does not define `columns`.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add tests/int/footer-config.int.spec.ts
git commit -m "test: specify footer admin columns"
```

### Task 2: Implement the reusable navigation columns field

**Files:**
- Create: `src/fields/navigationColumns.ts`
- Modify: `src/Footer/config.ts`
- Test: `tests/int/footer-config.int.spec.ts`

- [ ] **Step 1: Create the typed field factory**

Create `src/fields/navigationColumns.ts` with:

```ts
import type { ArrayField } from 'payload'

import { link } from '@/fields/link'

type NavigationColumnsType = (options: {
  description?: string
  label: string
  maxRows: number
  minRows: number
  name: string
  navItems: {
    maxRows: number
    minRows: number
  }
  rowLabels: {
    column: string
    navItem: string
  }
}) => ArrayField

export const navigationColumns: NavigationColumnsType = ({
  description,
  label,
  maxRows,
  minRows,
  name,
  navItems,
  rowLabels,
}) => ({
    name,
    type: 'array',
    label,
    interfaceName: 'NavigationColumn',
    required: true,
    minRows,
    maxRows,
    admin: {
      description,
      initCollapsed: true,
      components: {
        RowLabel: rowLabels.column,
      },
    },
    fields: [
      {
        name: 'label',
        type: 'text',
        label: 'Column heading',
        required: true,
      },
      {
        name: 'navItems',
        type: 'array',
        label: 'Links',
        required: true,
        minRows: navItems.minRows,
        maxRows: navItems.maxRows,
        admin: {
          initCollapsed: true,
          components: {
            RowLabel: rowLabels.navItem,
          },
        },
        fields: [link({ appearances: false })],
      },
    ],
  })
```

- [ ] **Step 2: Compose the field in Footer config**

Import `navigationColumns` in `src/Footer/config.ts`, remove the direct `link` import, and replace `fields` with:

```ts
fields: [
  navigationColumns({
    name: 'columns',
    label: 'Navigation columns',
    description:
      'Manage footer navigation here. Branding, contact details, social links, company details, and copyright are managed in Site Settings.',
    minRows: 1,
    maxRows: 4,
    navItems: {
      minRows: 1,
      maxRows: 8,
    },
    rowLabels: {
      column: '@/Footer/RowLabel#ColumnRowLabel',
      navItem: '@/Footer/RowLabel#NavItemRowLabel',
    },
  }),
],
```

Leave access, hooks, and `versions: false` unchanged.

- [ ] **Step 3: Run the focused test**

Run:

```bash
pnpm exec vitest run tests/int/footer-config.int.spec.ts --config ./vitest.config.mts
```

Expected: PASS for the serializable schema assertions.

- [ ] **Step 4: Commit the schema implementation**

```bash
git add src/fields/navigationColumns.ts src/Footer/config.ts
git commit -m "feat: group footer admin navigation"
```

### Task 3: Add Footer Admin row labels

**Files:**
- Modify: `src/Footer/RowLabel.tsx`
- Test: `tests/int/footer-config.int.spec.ts`

- [ ] **Step 1: Replace the Header-coupled label with two Footer row labels**

Replace `src/Footer/RowLabel.tsx` with:

```tsx
'use client'

import type { RowLabelProps } from '@payloadcms/ui'
import { useRowLabel } from '@payloadcms/ui'

type ColumnRow = { label?: string | null }
type NavItemRow = { link?: { label?: string | null } | null }

export const ColumnRowLabel: React.FC<RowLabelProps> = () => {
  const { data } = useRowLabel<ColumnRow>()
  return <div>{data?.label?.trim() || 'Navigation group'}</div>
}

export const NavItemRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<NavItemRow>()
  const position = rowNumber === undefined ? '' : ` ${rowNumber + 1}`
  const linkLabel = data?.link?.label?.trim()
  return <div>{linkLabel ? `Link${position}: ${linkLabel}` : `Link${position}`}</div>
}
```

The components must not import generated Header or Footer types.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/int/footer-config.int.spec.ts tests/int/vitest-config.int.spec.ts --config ./vitest.config.mts
```

Expected: both test files PASS.

- [ ] **Step 3: Run ESLint on changed source and test files**

Run:

```bash
pnpm exec eslint src/Footer/config.ts src/Footer/RowLabel.tsx src/fields/navigationColumns.ts tests/int/footer-config.int.spec.ts
```

Expected: exit code 0 with no errors.

- [ ] **Step 4: Commit row labels**

```bash
git add src/Footer/RowLabel.tsx
git commit -m "feat: label footer admin navigation rows"
```

### Task 4: Regenerate and verify the Payload Admin import map

**Files:**
- Modify: `src/app/(payload)/admin/importMap.js`
- Verify: `src/Footer/Component.tsx`

- [ ] **Step 1: Generate the Admin import map**

Run:

```bash
pnpm generate:importmap
```

Expected: exit code 0; the import map registers both generic navigation row-label exports.

- [ ] **Step 2: Verify both component references are present**

Run:

```bash
rg -n "ColumnRowLabel|NavItemRowLabel" 'src/app/(payload)/admin/importMap.js'
```

Expected: import and mapping entries exist for both exports.

- [ ] **Step 3: Verify the frontend Footer was not modified**

Run:

```bash
git diff --exit-code f75a5df -- src/Footer/Component.tsx
```

Expected: exit code 0 and no output.

- [ ] **Step 4: Generate Payload types**

Run:

```bash
pnpm generate:types
```

Expected: `src/payload-types.ts` contains `Footer.columns` and the reusable `NavigationColumn` interface, and no longer contains top-level `Footer.navItems`.

- [ ] **Step 5: Commit generated artifacts**

```bash
git add 'src/app/(payload)/admin/importMap.js' src/payload-types.ts
git commit -m "chore: register footer admin row labels"
```

### Task 5: Final Admin-only verification

**Files:**
- Test: `tests/int/footer-config.int.spec.ts`
- Verify: `src/Footer/config.ts`
- Verify: `src/fields/navigationColumns.ts`
- Verify: `src/Footer/RowLabel.tsx`
- Verify: `src/app/(payload)/admin/importMap.js`
- Verify: `src/payload-types.ts`

- [ ] **Step 1: Run the integration suite**

Run outside the restricted network sandbox when Payload initialization needs MongoDB:

```bash
pnpm test:int
```

Expected: all integration test files PASS. If the previously diagnosed sandbox-only MongoDB timeout occurs, rerun with local-network access rather than treating it as a product failure.

- [ ] **Step 2: Run repository lint without applying fixes**

Run:

```bash
pnpm lint
```

Expected: exit code 0, or report only pre-existing unrelated findings with exact paths. Do not edit unrelated files.

- [ ] **Step 3: Verify the exact scope of branch changes**

Run:

```bash
git status --short
git diff --stat f75a5df..HEAD
git diff --name-only f75a5df..HEAD
git diff --check f75a5df..HEAD
```

Expected implementation paths:

```text
src/Footer/config.ts
src/fields/navigationColumns.ts
src/app/(payload)/admin/importMap.js
src/payload-types.ts
tests/int/footer-config.int.spec.ts
```

The existing untracked `AGENTS.md`, `CLAUDE.md`, and `tsconfig.tsbuildinfo` are user/environment files and must not be added or modified.

- [ ] **Step 4: Record the deferred coordination work in the handoff**

The final report must state:

```text
Payload types now reflect footer.columns. The unchanged frontend Footer still consumes footer.navItems by explicit scope decision; the immediately following frontend task must migrate that consumer and verify the full build.
```

No additional commit is required if the worktree is clean apart from the pre-existing untracked environment files.
