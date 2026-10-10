# SEO Meta Image Auto Generate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add useful Meta Image Auto-generate buttons to all current SEO editors.

**Architecture:** One shared `generateImage` callback maps each document to its existing primary Media relation, confirms the target is an image through Payload, and returns the selected ID. Existing SEO fields expose the plugin button with `hasGenerateFn: true`.

**Tech Stack:** Payload 4 canary, `@payloadcms/plugin-seo`, TypeScript, Vitest.

---

### Task 1: Image source and validation

**Files:** `src/plugins/index.ts`, `tests/int/settings.int.spec.ts`, a focused SEO image generator test file.

- [x] **Step 1: Write failing tests** for source selection across Settings, Blogs, Posts, Pages, Case Studies; fallback to current image; reject video and inaccessible Media.
- [x] **Step 2: Run** the focused tests and confirm failure is caused by the missing generator.
- [x] **Step 3: Implement** the shared `generateImage` callback with Media `findByID`, project image MIME policy and no direct storage access.
- [x] **Step 4: Rerun** focused tests. The generator and button changes are committed together because both complete one SEO feature.

### Task 2: Enable buttons

**Files:** `src/Settings/fields/blog.ts`, `src/collections/Blogs/index.ts`, `src/collections/Posts/index.ts`, `src/collections/Pages/index.ts`, `src/collections/CaseStudies/index.ts`, existing schema tests.

- [x] **Step 1: Add failing schema assertions** that each manual `MetaImageField` has `hasGenerateImageFn: true`.
- [x] **Step 2: Run** the focused schema tests to confirm failure.
- [x] **Step 3: Set** `hasGenerateFn: true` on each field; keep relation and filter configuration.
- [x] **Step 4: Generate** Payload types and import map, run focused tests and TypeScript.

### Task 3: Browser check

**Files:** No source changes.

- [ ] **Step 1: Use an isolated local database and disabled R2** to verify a Media-backed Hero selection fills Meta Image in the Admin.
- [ ] **Step 2: Verify** Save persists the selected image and report exact validation results.

The active in-app browser at `localhost:3000` has no authenticated Admin session, so this browser check remains pending. The plugin callback, field wiring, typecheck, lint, and production build were verified locally.
