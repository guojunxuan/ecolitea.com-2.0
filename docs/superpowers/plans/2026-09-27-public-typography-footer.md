# Public Typography and Footer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Geist Sans role system to the public website and refine Footer typography and details while preserving its layout and CMS boundaries.

**Architecture:** `src/styles/typography.css` owns reusable role declarations; component CSS Modules compose those roles and own their local presentation. Scoped RichText styles distinguish Hero titles from article headings. Footer reads the existing Site Settings/Footer presentation model and uses global type and theme tokens without changing Payload data.

**Tech Stack:** Next.js 16, React 19, Payload 4 canary, TypeScript, CSS Modules, pnpm, Vitest, Playwright, MongoDB 7 for database-backed checks.

**Spec:** `docs/superpowers/specs/2026-09-27-public-typography-footer-design.md`

## Global Constraints

- Use installed `geist` fonts: Geist Sans for non-code public text and Geist Mono for code. Do not add dependencies or change lockfiles.
- Desktop roles: `display-1` 64/700/1/-2.125px; `display-2` 54/700/1.04/-1.875px; `heading-1` 40/700/1.1/-1px; `heading-2` 26/700/1.23/-0.625px; `heading-3` 22/700/1.27/-0.25px; `title` 20/600/1.4/-0.125px; `body-md` 16/400/1.5/0; `body-sm` 15/400/1.33/0; `button` 16/500/1.5/0; `caption` 14/400/1.43/0; `eyebrow` 12/600/1.33/+0.125px.
- Mobile title sizes: 48/42/32/24/20px; mobile tracking: -1.6/-1.5/-0.8/-0.5/-0.25px respectively. The existing 48rem breakpoint selects desktop title sizes.
- Enable `lnum` and `locl` on Sans body/heading roles. Global role classes remain margin-free.
- Preserve article body heading typography, the existing cool-gray palette and spacing rhythm, Footer layout/order/accordion, and the disabled newsletter placeholder.
- Preserve the three existing uncommitted typography edits until each is intentionally incorporated or superseded. Preserve unrelated untracked workspace content.
- Site Settings continues to own brand, contact, social, newsletter, and legal data; Footer Global continues to own navigation columns. No Payload schema or generated artifacts change.

## Review Focus

1. A long Chinese or English Hero title at 375px wraps without horizontal overflow: Task 2 browser check and scoped Hero test.
2. An article heading and an embedded RichText block retain their own heading rules after Hero styles change: Task 2 scoped RichText test.
3. A content card inside a narrow grid remains readable at the new 22px desktop / 20px mobile title sizes: Task 3 browser check and class-mapping test.
4. A Footer with zero or four navigation columns preserves the current layout/accordion behavior: Task 4 existing component test plus browser check.
5. Missing social/contact values do not leave empty visual rows, and a supplied social SVG stays inside its 44px target: Task 4 component and browser checks.

---

### Task 1: Establish the Global Type Roles

**Files:**
- Modify: `src/styles/typography.css`
- Modify: `tests/int/global-visual-foundation.int.spec.ts`

**Interfaces:**
- Consumes: `--website-font-sans`, `--website-font-mono`, and the existing `@layer base, components, utilities` order.
- Produces: global classes `.website-type-display-1`, `-display-2`, `-heading-1`, `-heading-2`, `-heading-3`, `-title`, `-body-md`, `-body-sm`, `-button`, `-caption`, `-eyebrow`, and the existing `.website-type-code` exception. Later tasks compose these exact names.

- [ ] **Step 1: Write the failing test.** Replace the old nine-role assertion with a table checking all eleven mobile and desktop size/weight/line-height/tracking values, Sans family, `lnum`/`locl`, margin-free declarations, and Mono for `code`. Assert the 48rem breakpoint and the five mobile tracking values.
- [ ] **Step 2: Verify failure.** Run `corepack pnpm test:int -- tests/int/global-visual-foundation.int.spec.ts`; expect the typography assertion to fail against the old classes.
- [ ] **Step 3: Implement the role contract.** Define the eleven classes and responsive title overrides in `typography.css`, retaining the base heading reset and the Mono code class. Keep the old Sans classes temporarily so existing consumers render through Tasks 2–3. Replace the current uncommitted B tracking values with the approved exact values.
- [ ] **Step 4: Verify pass and commit.** Rerun the focused test; expect pass. Stage only the two files and commit `style: define public typography roles`.

### Task 2: Map Page and Hero Titles Without Changing Article Headings

**Files:**
- Modify: `src/app/(frontend)/pages.module.css`
- Modify: `src/heros/PostHero/index.module.css`
- Modify: `src/styles/content.css`
- Modify: `tests/int/frontend-module-visual-roles.int.spec.ts`
- Modify: `tests/int/rich-text-styles.int.spec.tsx`

**Interfaces:**
- Consumes: Task 1 role names and the existing `data-hero` values `low-impact`, `medium-impact`, `high-impact`, and `post`.
- Produces: page-title `heading-1`, PostHero `display-1`, and Hero-scoped RichText title mappings (`high` `display-1`, `medium` `display-2`, `low` `heading-1`) without changing article RichText headings.

- [ ] **Step 1: Write failing tests.** Assert `.pageTitle` composes `website-type-heading-1`; PostHero's title composes `display-1` rather than hardcoded breakpoint sizes; Hero-scoped h1 rules resolve to the three approved roles; ordinary and embedded RichText h1–h6 remain outside Hero title selectors; ordinary RichText paragraphs use 16px / 1.5. Include a long-title/wrapping assertion on the Hero-owned boundary.
- [ ] **Step 2: Verify failure.** Run `corepack pnpm test:int -- tests/int/frontend-module-visual-roles.int.spec.ts tests/int/rich-text-styles.int.spec.tsx`; expect the new role assertions to fail.
- [ ] **Step 3: Implement scoped consumers.** Change `.pageTitle` and PostHero `.title` to compose the Task 1 classes, preserving their layout rules. Replace the existing uncommitted generic Hero negative-tracking rule with scoped role-aligned Hero h1 declarations in `content.css`. Keep article heading sizes/margins untouched and change only ordinary prose line height to 1.5.
- [ ] **Step 4: Verify and inspect.** Rerun both focused tests; expect pass. At 375px and desktop width inspect long Hero titles, PostHero, listing title, article h2–h6, and embedded RichText; expect no overflow or article heading regression.
- [ ] **Step 5: Commit.** Stage only this task's files and commit `style: map public page and hero titles`.

### Task 3: Map Content and Controls to the Type Roles

**Files:**
- Modify: `src/styles/typography.css`, `tests/int/global-visual-foundation.int.spec.ts` (retire temporary old Sans aliases after migration)
- Modify: `src/components/Card/index.module.css`, `src/components/ui/card.module.css`, `src/components/PageRange/index.module.css`
- Modify: `src/components/ui/button.module.css`, `src/components/ui/input.module.css`, `src/components/ui/select.module.css`, `src/components/ui/textarea.module.css`, `src/components/ui/label.module.css`
- Modify where the role is actually consumed: `src/Header/Component.module.css`, `src/Header/Nav/index.module.css`, `src/Header/Nav/blocks.module.css`, `src/blocks/Banner/Component.module.css`, `src/blocks/Form/Error/index.module.css`
- Modify: `tests/int/frontend-module-visual-roles.int.spec.ts`

**Interfaces:**
- Consumes: Task 1 role classes. CSS Modules compose a class only for the typography it represents; local layout, semantic colors, control dimensions, and state styles remain in their existing owners.
- Produces: Card/UI Card titles `heading-3`, Card descriptions `body-md`, UI Card descriptions and PageRange `body-sm`, Card category labels `eyebrow`, shared buttons `button`, form input/select/textarea text `body-md`, form labels and errors `caption`, desktop Header links `body-sm`, mobile primary Header links `title`, and compact Header group labels `eyebrow`.

- [ ] **Step 1: Write failing consumer tests.** Update the existing role-mapping table to assert each mapping in this task's Interfaces block. Keep the Code block on `website-type-code` and keep semantic HTML assertions. Assert that Banner and Form Error text retain their status colors while drawing base typography from `body-md` and `caption` respectively. Add a visual-foundation assertion that old Sans role classes are absent after migration.
- [ ] **Step 2: Verify failure.** Run `corepack pnpm test:int -- tests/int/frontend-module-visual-roles.int.spec.ts tests/int/global-visual-foundation.int.spec.ts`; expect old role mappings and temporary aliases to fail.
- [ ] **Step 3: Apply role mappings.** Replace obsolete `composes` names and local duplicate typography values in the listed CSS Modules according to the Interfaces mapping. Once all consumers have moved, remove the temporary old Sans classes from `src/styles/typography.css` and assert no old role names remain in public CSS. Keep context-specific emphasis (such as selected nav weight) local, but take base size/line-height/family from the shared role. Do not change control size, layout, state behavior, or Admin-only presentation.
- [ ] **Step 4: Verify and inspect.** Rerun both focused tests and existing UI component tests; expect pass. Inspect a narrow card grid, navigation, buttons, inputs, and labels at 375px and desktop width for wrapping and readable hierarchy.
- [ ] **Step 5: Commit.** Stage only task-owned files and commit `style: apply typography roles to public components`.

### Task 4: Refine Footer Within Its Existing Data and Layout Boundaries

**Files:**
- Modify: `src/Footer/index.module.css`
- Modify: `tests/int/footer-component.int.spec.tsx`
- Modify: `tests/int/frontend-module-visual-roles.int.spec.ts`
- Read without changing: `src/Footer/Component.tsx`, `src/Footer/Navigation.client.tsx`, `src/Footer/ContactList.tsx`, `src/Footer/adaptFooter.ts`, `src/SiteSettings/fields/contact.ts`, `src/SiteSettings/fields/social.ts`

**Interfaces:**
- Consumes: Task 1 roles; `--website-color-*`, `--website-space-*`, `--website-icon-*`, and `--website-control-target-min` tokens; existing Footer presentation data.
- Produces: brand/newsletter/input `body-sm`, Footer navigation links `caption` at 14px / 400, navigation headings and mobile triggers `caption` at 14px with Footer-owned 600 weight / 0.055em tracking / uppercase emphasis, newsletter `title`, disabled subscription button `button`, contact/legal/copyright `caption`, and 24px social icons inside 44px targets.

- [ ] **Step 1: Write failing tests.** Assert the Footer role compositions, navigation heading's 600 weight against 400-weight links at equal 15px base size, social target size and icon token usage, caption contact/legal mapping, and existing three-column breakpoint/accordion selectors. Add a component case with absent social/contact fields and verify no empty rendered list rows.
- [ ] **Step 2: Verify failure.** Run `corepack pnpm test:int -- tests/int/footer-component.int.spec.tsx tests/int/frontend-module-visual-roles.int.spec.ts`; expect the new style assertions to fail.
- [ ] **Step 3: Apply Footer style changes.** Edit only `index.module.css`: compose roles, use existing semantic inverse tokens and spacing tokens for local details, refine circular social buttons and contact icon alignment, and preserve grid rules, element order, accordion rules, and disabled controls. Leave Payload configs and adapters unchanged.
- [ ] **Step 4: Verify and inspect.** Rerun focused tests; expect pass. Inspect Footer at 375px, tablet, and desktop with zero/four columns and missing social/contact values; expect no layout shift, orphan rows, icon overflow, or changed accordion behavior.
- [ ] **Step 5: Commit.** Stage only Footer CSS and task tests; commit `style: refine footer typography and details`.

### Task 5: End-to-End Visual and Build Gate

**Files:**
- Modify only if a real regression is found: the task-owned source and test files above.
- Test: `tests/e2e/website-shell.e2e.spec.ts` if its existing assertions need the approved type measurements.

**Interfaces:**
- Consumes: Tasks 1–4. Produces a verified branch and an exact report of any environment limits.

- [ ] **Step 1: Run focused integration suites.** Run `corepack pnpm test:int -- tests/int/global-visual-foundation.int.spec.ts tests/int/frontend-module-visual-roles.int.spec.ts tests/int/rich-text-styles.int.spec.tsx tests/int/footer-component.int.spec.tsx`; expect pass.
- [ ] **Step 2: Run static checks.** Run `corepack pnpm exec tsc --noEmit --incremental false` and `corepack pnpm lint`; expect no new errors.
- [ ] **Step 3: Run the production build.** Run `corepack pnpm build` with the documented local/isolated MongoDB environment; expect success. Do not treat a database connection failure as a CSS regression.
- [ ] **Step 4: Check responsive behavior.** Run the relevant `website-shell` browser tests or focused browser inspection with the local site at 375px, 768px, and desktop width. Capture any actual wrapping/layout problems, fix only those problems, and rerun the affected check.
- [ ] **Step 5: Inspect and report.** Review the final diff against the spec, confirm unrelated work remains untouched, record commit IDs and exact verification results, and report any residual limitation. Commit a test-only correction if one was required; otherwise do not create an empty commit.
