# Footer Admin Columns Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Payload Admin Footer global's flat navigation array with a grouped `columns → navItems → link` editor without changing frontend Footer rendering.

**Architecture:** The Footer global remains the owner of navigation structure only. A top-level `columns` array contains a required title and a bounded nested link array built with the existing shared `link` field; local Admin row-label components avoid depending on temporarily stale generated Payload types. Because the current frontend still reads `footer.navItems`, Payload type generation is deliberately deferred until the separately approved frontend migration.

**Tech Stack:** Payload CMS 4 canary, TypeScript 6, React 19, Vitest 4, Payload Admin custom row labels

---

## Scope Guard

Do not modify `src/Footer/Component.tsx`, `src/SiteSettings/**`, `src/payload-types.ts`, or `src/endpoints/seed/index.ts`.

Do not run `pnpm generate:types` in this scope. Regenerating the Footer type would remove `footer.navItems` while the unchanged frontend component still reads it. Type generation belongs to the later frontend Footer migration, where schema and consumer can move together.

## File Map

- Create `tests/int/footer-config.int.spec.ts`: focused contract tests for the Admin-only Footer schema.
- Modify `src/Footer/config.ts`: replace top-level `navItems` with the bounded `columns` array and nested link editor.
- Modify `src/Footer/RowLabel.tsx`: expose local, generated-type-independent labels for columns and nested links.
- Modify `src/app/(payload)/admin/importMap.js`: generated registration for the two row-label components.
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
      admin: {
        initCollapsed: true,
        components: { RowLabel: '@/Footer/RowLabel#FooterColumnRowLabel' },
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
        components: { RowLabel: '@/Footer/RowLabel#FooterLinkRowLabel' },
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

### Task 2: Implement grouped Footer navigation fields

**Files:**
- Modify: `src/Footer/config.ts`
- Test: `tests/int/footer-config.int.spec.ts`

- [ ] **Step 1: Replace the flat array with the columns schema**

Replace the `fields` value in `src/Footer/config.ts` with:

```ts
fields: [
  {
    name: 'columns',
    type: 'array',
    label: 'Navigation columns',
    required: true,
    minRows: 1,
    maxRows: 4,
    admin: {
      description:
        'Manage footer navigation here. Branding, contact details, social links, company details, and copyright are managed in Site Settings.',
      initCollapsed: true,
      components: {
        RowLabel: '@/Footer/RowLabel#FooterColumnRowLabel',
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
        minRows: 1,
        maxRows: 8,
        admin: {
          initCollapsed: true,
          components: {
            RowLabel: '@/Footer/RowLabel#FooterLinkRowLabel',
          },
        },
        fields: [link({ appearances: false })],
      },
    ],
  },
],
```

Leave access, hooks, and `versions: false` unchanged.

- [ ] **Step 2: Run the focused test**

Run:

```bash
pnpm exec vitest run tests/int/footer-config.int.spec.ts --config ./vitest.config.mts
```

Expected: PASS for the serializable schema assertions.

- [ ] **Step 3: Commit the schema implementation**

```bash
git add src/Footer/config.ts
git commit -m "feat: group footer admin navigation"
```

### Task 3: Add generated-type-independent Admin row labels

**Files:**
- Modify: `src/Footer/RowLabel.tsx`
- Test: `tests/int/footer-config.int.spec.ts`

- [ ] **Step 1: Replace the Header-dependent row label with two local components**

Replace `src/Footer/RowLabel.tsx` with:

```tsx
'use client'

import type { RowLabelProps } from '@payloadcms/ui'
import { useRowLabel } from '@payloadcms/ui'

type FooterColumnRow = { label?: string | null }
type FooterLinkRow = { link?: { label?: string | null } | null }

export const FooterColumnRowLabel: React.FC<RowLabelProps> = () => {
  const { data } = useRowLabel<FooterColumnRow>()
  return <div>{data?.label?.trim() || 'Navigation group'}</div>
}

export const FooterLinkRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<FooterLinkRow>()
  const position = rowNumber === undefined ? '' : ` ${rowNumber + 1}`
  const linkLabel = data?.link?.label?.trim()
  return <div>{linkLabel ? `Link${position}: ${linkLabel}` : `Link${position}`}</div>
}
```

This removes the incorrect `Header` type import and keeps the Admin components valid before later coordinated Payload type generation.

- [ ] **Step 2: Run focused tests**

Run:

```bash
pnpm exec vitest run tests/int/footer-config.int.spec.ts tests/int/vitest-config.int.spec.ts --config ./vitest.config.mts
```

Expected: both test files PASS.

- [ ] **Step 3: Run ESLint on changed source and test files**

Run:

```bash
pnpm exec eslint src/Footer/config.ts src/Footer/RowLabel.tsx tests/int/footer-config.int.spec.ts
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

Expected: exit code 0; the import map registers both Footer row-label exports.

- [ ] **Step 2: Verify both component references are present**

Run:

```bash
rg -n "FooterColumnRowLabel|FooterLinkRowLabel" 'src/app/(payload)/admin/importMap.js'
```

Expected: import and mapping entries exist for both exports.

- [ ] **Step 3: Verify the frontend Footer was not modified**

Run:

```bash
git diff --exit-code f75a5df -- src/Footer/Component.tsx
```

Expected: exit code 0 and no output.

- [ ] **Step 4: Commit the generated import map**

```bash
git add 'src/app/(payload)/admin/importMap.js'
git commit -m "chore: register footer admin row labels"
```

### Task 5: Final Admin-only verification

**Files:**
- Test: `tests/int/footer-config.int.spec.ts`
- Verify: `src/Footer/config.ts`
- Verify: `src/Footer/RowLabel.tsx`
- Verify: `src/app/(payload)/admin/importMap.js`

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
src/Footer/RowLabel.tsx
src/Footer/config.ts
src/app/(payload)/admin/importMap.js
tests/int/footer-config.int.spec.ts
```

The existing untracked `AGENTS.md`, `CLAUDE.md`, and `tsconfig.tsbuildinfo` are user/environment files and must not be added or modified.

- [ ] **Step 4: Record the deferred coordination work in the handoff**

The final report must state:

```text
Payload type generation is intentionally deferred. The next frontend Footer task must update src/Footer/Component.tsx to consume footer.columns, then run pnpm generate:types and verify the full build in the same change.
```

No additional commit is required if the worktree is clean apart from the pre-existing untracked environment files.
