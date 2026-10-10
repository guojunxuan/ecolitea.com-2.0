# Blog Category Navigation Implementation Plan

**Goal:** Replace category buttons with text links and a sliding underline, hiding article counts.

**Architecture:** Keep category filtering in BlogCategoryTabs. CategoryLinks owns desktop hover measurement beside the persistent selected underline, and MobileCategoryMenu owns a native details dropdown. CSS uses the Header indicator thickness, speed and easing.

**Tech Stack:** React 19, Next.js 16, CSS Modules, Vitest.

### Task 1: Navigation interaction and presentation

- [x] Add focused interaction tests to `tests/int/blog-category-navigation.int.spec.tsx`: default All, hidden counts, hover/leave, focus, currentCategory changes and dropdown dismissal. Run tests before implementation.
- [x] Create `src/components/BlogCategoryTabs/CategoryLinks.tsx` to render links and a separate aria-hidden hover indicator. Measure relative link geometry, observe resize/font load, preserve the current item's fixed underline, and clean up observers.
- [x] Add `MobileCategoryMenu.tsx` with a native Blog dropdown, all populated category links, Escape/outside/click dismissal. Pass the same filtered links from `index.tsx` to both components.
- [x] Update its CSS Module to remove button treatments/count styling; right-align desktop text links with a static selected underline plus 2px sliding hover underline; add the mobile dropdown panel, focus outline and reduced-motion.
- [x] Run focused interaction and existing listing component tests, TypeScript and targeted lint. Verify desktop fixed/secondary lines and 390px/320px dropdown rendering in the local browser.
- [x] Commit the feature and design/plan records on the current feature branch; preserve unrelated work.

Verification: 13 component tests passed; TypeScript and targeted ESLint passed. Browser checks confirmed right alignment, persistent 2px selected line beside the focused-item line, category navigation, all dropdown links, Escape/outside dismissal and no mobile horizontal overflow. Existing E2E expectations were updated for hidden counts and the new dropdown; the full database-backed E2E suite was not rerun for this presentation change.
