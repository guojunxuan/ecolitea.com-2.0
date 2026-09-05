# Site Settings Social Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Site Settings Social administration workflow, remove all production demo seed code, and enforce Social Platform/Social Link integrity without changing frontend Header or Footer rendering.

**Architecture:** Keep persistence rules in Payload collection/global schema hooks and validators so Admin, REST, GraphQL, and Local API share one boundary. Keep Admin customization local to the Site Settings Social field: a reusable native Payload Drawer controller/form, a relationship wrapper for relationship-origin creation, a row-label resolver, and narrowly scoped array-action suppression. Generated Payload artifacts remain generated outputs.

**Tech Stack:** Next.js 16.3.3 App Router, React 19 client components, Payload CMS 4 canary, TypeScript, Vitest/Testing Library, Playwright, MongoDB.

---

### Task 1: Preserve and complete demo seed removal

**Files:**
- Delete: `src/endpoints/seed/**`
- Preserve deletion: `src/app/(frontend)/next/seed/route.ts`
- Preserve deletion: `src/components/BeforeDashboard/**`
- Modify: `tests/int/site-settings.int.spec.ts`
- Delete or rewrite: `tests/int/site-settings-seed-db.int.spec.ts`
- Create/modify: `tests/e2e/seed-removal.e2e.spec.ts`
- Create: `tests/fixtures/*` only if a surviving E2E imports a deleted seed image

- [ ] **Step 1: Write/retain failing regression assertions** that `/next/seed` returns 404 and that config/imports/files contain no seed endpoint, `seedSocialSettings`, `BeforeDashboard`, or demo fallback.
- [ ] **Step 2: Run the focused Vitest and Playwright tests** and verify failure is caused by the surviving seed helper or stale imports.
- [ ] **Step 3: Remove only production seed modules and seed-only tests**, moving any genuinely reused binary into `tests/fixtures` and updating that test import.
- [ ] **Step 4: Re-run focused tests** and expect the seed-removal assertions to pass.

### Task 2: Enforce Social Platform server contracts

**Files:**
- Modify: `src/collections/SocialPlatforms.ts`
- Modify: `tests/int/site-settings.int.spec.ts`
- Create/modify: a Mongo-backed Social Platform integration spec if required

- [ ] **Step 1: Add failing tests** for exact duplicate rejection, case-distinct names, immutable names, disabled document duplication, required icon on create/update, cleared icon, missing relationship, and non-SVG asset.
- [ ] **Step 2: Run focused tests** and confirm each new assertion fails for the missing rule.
- [ ] **Step 3: Implement minimal collection config**: exact `unique: true`, create-only editable name with immutable server hook and stable error, `disableDuplicate: true`, and an icon validator that rejects empty/unresolved/non-SVG values with stable messages.
- [ ] **Step 4: Re-run focused tests** and expect all Social Platform contract cases to pass.

### Task 3: Simplify and validate Social Links

**Files:**
- Modify: `src/SiteSettings/fields/social.ts`
- Create: `src/SiteSettings/validators/validateUniqueSocialPlatforms.ts`
- Modify: `tests/int/site-settings.int.spec.ts`

- [ ] **Step 1: Add failing schema/type/validator tests** proving `label` is absent and repeated scalar or populated relationship IDs are rejected with a stable row-aware message.
- [ ] **Step 2: Run focused tests** and verify expected RED failures.
- [ ] **Step 3: Remove `label` and attach an array-level uniqueness validator** that accepts empty/nonduplicate rows and normalizes only relationship shape, never platform-name casing.
- [ ] **Step 4: Re-run focused tests** and expect GREEN.

### Task 4: Add deterministic Social Link row labels

**Files:**
- Create: `src/SiteSettings/components/SocialLinkRowLabel.tsx`
- Modify: `src/SiteSettings/fields/social.ts`
- Modify: `tests/int/social-platform-admin.int.spec.tsx`

- [ ] **Step 1: Add failing component tests** for populated platform name, unselected fallback, unresolved/deleted fallback, and a loading label that never exposes the raw ID.
- [ ] **Step 2: Run the component spec** and verify RED.
- [ ] **Step 3: Implement the smallest client RowLabel resolver** using Payload form/row state and Payload API access while retaining stable fallback strings.
- [ ] **Step 4: Re-run the component spec** and expect GREEN.

### Task 5: Restrict only Social Links array actions

**Files:**
- Create: `src/SiteSettings/components/SocialLinksArrayField.tsx` and a colocated scoped stylesheet only if Payload exposes no component prop for these actions
- Modify: `src/SiteSettings/fields/social.ts`
- Modify: `tests/int/social-platform-admin.int.spec.tsx`

- [ ] **Step 1: Add failing tests** showing Add Below, drag/move/remove remain while Copy Field, Paste Field, Duplicate, Copy Row, Paste Below, and Replace Row are absent; render an unrelated Array to prove its actions remain.
- [ ] **Step 2: Run the component tests** and verify RED.
- [ ] **Step 3: Implement a local field boundary around Payload's native Array field/action rendering**, using supported component/config extension points and tightly scoped selectors only where no prop exists; do not fork the Array implementation.
- [ ] **Step 4: Re-run component tests** and expect GREEN for both restricted and ordinary arrays.

### Task 6: Replace the custom Modal with one native Drawer flow

**Files:**
- Delete: `src/SiteSettings/components/SocialPlatformCreateModal.tsx`
- Delete: `src/SiteSettings/components/socialPlatformCreateModal.scss`
- Create: `src/SiteSettings/components/SocialPlatformDrawer.tsx` plus focused controller/form modules if needed
- Modify: `src/SiteSettings/components/SocialPlatformCreateActions.tsx`
- Modify: `src/SiteSettings/components/SocialPlatformRelationshipField.tsx`
- Modify: `tests/int/social-platform-admin.int.spec.tsx`

- [ ] **Step 1: Add failing component tests** for both entry points opening the same Drawer, no sentinel option/timer/Modal, cancel/back return, disabled save while pending, failed create preserving form and Drawer without success, top-level success notification, and relationship-origin success selecting the new ID/refreshing its label.
- [ ] **Step 2: Run the component spec** and verify failures describe the old Modal/sentinel flow.
- [ ] **Step 3: Implement one native right-side Payload Drawer form** shared by both triggers, with explicit origin context, Payload validation error rendering, guarded submission, refresh callbacks, and native relationship upload/create support.
- [ ] **Step 4: Re-run the component spec** and expect GREEN; confirm edit continues through Payload's relationship edit affordance with immutable-name guidance from collection config.

### Task 7: Regenerate artifacts and run full verification

**Files:**
- Generate: `src/payload-types.ts`
- Generate: `src/app/(payload)/admin/importMap.js`

- [ ] **Step 1: Run `pnpm generate:types`** and verify generated Social Links contain only `platform`, `url`, and Payload row ID metadata.
- [ ] **Step 2: Run `pnpm generate:importmap`** and verify Modal imports disappear and new Admin components resolve.
- [ ] **Step 3: Run focused component and integration specs**, then `pnpm test:int`; if MongoDB access is sandbox-blocked, request local connection permission and rerun.
- [ ] **Step 4: Run relevant Playwright E2E**, including `/next/seed` 404 and Social Admin flows.
- [ ] **Step 5: Run `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build`**, classifying any pre-existing Header/Footer frontend adaptation failures without modifying that out-of-scope code.
- [ ] **Step 6: Run `git diff --check` and targeted `rg` scans** for seed, Modal, sentinel, Social Link `label`, `BeforeDashboard`, stale generated imports, and global Array overrides.
- [ ] **Step 7: Review `git status` and diff** to ensure existing demo-seed deletions were preserved, no unrelated files changed, and no merge/push occurred.
