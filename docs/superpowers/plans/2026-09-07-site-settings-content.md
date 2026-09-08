# Site Settings Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved General, Contact, Newsletter, Social, Footer, and cached Global query contracts.

**Architecture:** Keep fixed business fields typed in the Site Settings Global, use reusable Payload Array fields for display-only additions, and adapt the resulting data into a small Footer presentation model. Encapsulate relationship depth in one cached query function per Global so components never select depth.

**Tech Stack:** Payload CMS 4 canary, Next.js 16, React 19, TypeScript, Vitest, Playwright, Lucide React.

**Spec:** `docs/superpowers/specs/2026-09-07-site-settings-content-design.md`

## Global Constraints

- Do not add dependencies.
- Preserve unnamed Site Settings tabs and existing flat field paths.
- Do not add a Form relationship or newsletter submission behavior.
- Do not use CSS filters to recolor Social icons.
- Do not use local file routing as a fallback for missing R2 Brand Assets.
- Do not stage `.playwright-cli/`.

---

### Task 1: Shared custom fields and required Site Settings schema

**Files:**
- Create: `src/SiteSettings/fields/customFields.ts`
- Create: `src/SiteSettings/fields/validation.ts`
- Modify: `src/SiteSettings/fields/general.ts`
- Modify: `src/SiteSettings/fields/contact.ts`
- Modify: `tests/int/site-settings.int.spec.ts`

**Interfaces:**
- Produces: `customFields({ name, label }): ArrayField`, `trimText: FieldHook`, and `validateNonBlankText: TextFieldValidation`.
- Produces flat `customFields`, `contactCustomFields`, and named `newsletter` properties on `SiteSettings`.

- [ ] **Step 1: Write failing schema tests** asserting four required General fields, three required Contact fields, removal of WhatsApp and Business Hours, both custom arrays, and the Newsletter group contract.
- [ ] **Step 2: Run `corepack pnpm exec vitest run tests/int/site-settings.int.spec.ts` and confirm the new assertions fail for missing schema.**
- [ ] **Step 3: Implement the reusable validation and Array factory, then update General and Contact with the exact approved fields and defaults.**
- [ ] **Step 4: Run the focused test and confirm it passes.**

### Task 2: Standard cached Global query owners

**Files:**
- Modify: `src/utilities/getGlobals.ts`
- Modify: `src/Header/Component.tsx`
- Modify: `src/Footer/Component.tsx`
- Modify: `src/app/(frontend)/layout.tsx`
- Test: `tests/int/get-globals-cache.int.spec.ts`
- Modify: `tests/int/footer-component.int.spec.tsx`
- Modify: `tests/int/logo.int.spec.tsx`

**Interfaces:**
- Produces: `getCachedHeader()`, `getCachedFooter()`, and `getCachedSiteSettings()` async cached readers.
- Consumers no longer call `getCachedGlobal(slug, depth)` directly.

- [ ] **Step 1: Extend the cache test to assert each standard reader has one stable key/tag and Site Settings resolves depth 2.**
- [ ] **Step 2: Run the cache and component tests and confirm they fail because standard readers do not exist.**
- [ ] **Step 3: Implement standard readers over the existing generic primitive and migrate all three consumers.**
- [ ] **Step 4: Run cache, Header, Footer, Logo, and layout integration tests and confirm they pass.**

### Task 3: Footer presentation model and rendering

**Files:**
- Create: `src/Footer/ContactList.tsx`
- Modify: `src/Footer/types.ts`
- Modify: `src/Footer/adaptFooter.ts`
- Modify: `src/Footer/Component.tsx`
- Modify: `src/Footer/index.module.css`
- Modify: `tests/int/footer-adapter.int.spec.ts`
- Modify: `tests/int/footer-component.int.spec.tsx`
- Modify: `tests/int/footer-payload-depth.int.spec.tsx`

**Interfaces:**
- Produces: required `ContactData`, nullable `NewsletterData`, and a `ContactList` using `MapPin`, `Phone`, and `Mail`.
- Consumes Site Settings newsletter content and hidden interface copy through `adaptFooter`.

- [ ] **Step 1: Write failing adapter and rendering tests for removed contact fields, inline icons, hidden Newsletter behavior, and CMS-provided Newsletter copy.**
- [ ] **Step 2: Run focused Footer tests and confirm the expected failures.**
- [ ] **Step 3: Update the adapter/types, extract ContactList, remove hard-coded Newsletter copy, and update responsive styles.**
- [ ] **Step 4: Run focused Footer tests and confirm they pass.**

### Task 4: Generated artifacts and data compatibility

**Files:**
- Modify: `src/payload-types.ts` using Payload generation.
- Modify if generated: `src/app/(payload)/admin/importMap.js`.

**Interfaces:**
- Produces generated `SiteSettings` types matching the implemented schema.

- [ ] **Step 1: Run `corepack pnpm generate:types`.**
- [ ] **Step 2: Run `corepack pnpm generate:importmap`.**
- [ ] **Step 3: Inspect generated diffs and confirm removed fields, required types, Newsletter, and both custom arrays match the spec.**
- [ ] **Step 4: Run `corepack pnpm exec tsc --noEmit`.**

### Task 5: Full regression and browser verification

**Files:**
- Modify only tests that expose genuine contract changes.

**Interfaces:**
- Verifies all preceding interfaces together.

- [ ] **Step 1: Run `corepack pnpm test:int`.**
- [ ] **Step 2: Run `corepack pnpm lint`.**
- [ ] **Step 3: Run `corepack pnpm build`.**
- [ ] **Step 4: Run the relevant website shell and Site Settings Playwright tests against the branch service.**
- [ ] **Step 5: Inspect `git diff --check`, the final diff, and `git status --short`; exclude `.playwright-cli/`.**

