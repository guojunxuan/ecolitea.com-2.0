# Settings Blog Admin Folding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the visible Listing page level and present Hero and SEO as native collapsible sections.

**Architecture:** Keep the named `listing`, `hero`, and `seo` groups so persisted data paths remain stable. Wrap Hero and SEO groups in unnamed Payload collapsibles and hide the listing group's label.

**Tech Stack:** Payload 4 canary, TypeScript, Next.js 16.

**Verification constraint:** The user explicitly requested no test execution. Keep existing structural assertions synchronized, regenerate Payload artifacts, and report that tests were skipped.

---

### Task 1: Admin field structure

**Files:** `src/Settings/fields/blog.ts`, `tests/int/settings.int.spec.ts`

- [x] **Step 1: Wrap** the two existing named groups in native collapsibles with `label: 'Hero'` / `label: 'SEO'`, `admin.initCollapsed: false` / `true`; set the listing group label to false and hide its gutter.
- [x] **Step 2: Update** the existing Settings structural assertions to follow the new wrappers without adding new test cases.
- [x] **Step 3: Generate** types and import map with `corepack pnpm generate:types` and `corepack pnpm generate:importmap`.
- [x] **Step 4: Commit** the field and assertion changes.

### Task 2: Review and report

**Files:** No new source files.

- [x] **Step 1: Review** Git diff and confirm stored field names and plugin paths remain unchanged.
- [x] **Step 2: Report** generated artifacts and the skipped tests.
