# macOS-style Admin implementation plan

> **For agentic workers** — Use superpowers:executing-plans and complete each task before starting the next.

**Goal** — Apply the approved Admin appearance, site branding, Dashboard and navigation, and remove the public frontend's template brand defaults.

**Architecture** — Keep Payload's native navigation and Dashboard layout. Register server components in public graphics and widget slots, normalize data before rendering, and map installed semantic CSS tokens onto the project palette.

**Tech stack** — Payload 4 canary.29, Next.js 16, TypeScript, CSS Modules, Vitest and Playwright.

**Spec** — [Admin UI redesign](../specs/2026-11-19-admin-ui-macos-redesign-design.md)

## Constraints and verification environment

- Work on `feature/admin-ui-macos`. Stage explicit paths. Force-add only this plan.
- Follow the spec's selector allowlist, use no Apple assets, keep the persisted schema and native Nav, and regenerate Payload artifacts through the CLI.
- Preserve the two legacy Posts titles under the explicit §8 exception. The source guard pins the exception to those exact existing strings.
- Run integration tests with `DISABLE_R2_STORAGE=true DATABASE_URI=mongodb://127.0.0.1:27017/admin-ui-test JOBS_AUTORUN=false`. The browser suite creates its own run-scoped database from the local `ecolitea2-phase4-e2e` base. Port 3000 and its developer database stay outside verification.

## 1. Style the Admin through tokens

- [x] Create `tests/int/admin-theme.int.spec.ts`. Use `cssAudit.ts` to check the selector allowlist, installed semantic tokens, brand literals and absence of important declarations. Assert both palettes include the brand accent.
- [x] Run `corepack pnpm test:int tests/int/admin-theme.int.spec.ts` and observe the missing overrides.
- [x] Add the primitive light/dark palettes and semantic mappings in `src/app/(payload)/custom.css`. Map both explicit themes and the default root.
- [x] Re-run the same test and commit with `feat(admin): theme Payload with semantic tokens`.

## 2. Register brand graphics

- [x] Create `tests/int/admin-brand.int.spec.ts` covering empty settings, whitespace, unresolved relationships, and resolved logo/favicon.
- [x] Run `corepack pnpm test:int tests/int/admin-brand.int.spec.ts` before implementing.
- [x] Implement `resolveAdminBrand(settings)`, `AdminLogo.tsx`, `AdminIcon.tsx`, and `AdminBrand.module.css` in `src/components/admin/brand`. Read the existing depth-one cached global and use the public graphics slots, explicit theme and static Admin metadata in `src/payload.config.ts`. Remove `src/components/BeforeLogin/index.tsx`.
- [x] Run `corepack pnpm generate:importmap` and the brand test, then commit with `feat(admin): use Site Settings for admin branding`.

## 3. Group navigation

- [x] Create `tests/int/admin-navigation.int.spec.ts`. Assert spec group membership, native collection order and declared hidden flags.
- [x] Run `corepack pnpm test:int tests/int/admin-navigation.int.spec.ts` before implementing.
- [x] Set `admin.group` in Pages, Posts, Blogs, BlogCategories, CaseStudies, Categories, Products, ProductCategories, QuoteRequests, Media, Documents, SiteAssets, Users, Header, Footer, Settings and SiteSettings configs. Group folders and reorder the collections array in `src/payload.config.ts`. Group plugin collections through overrides in `src/plugins/index.ts`.
- [x] Re-run the navigation test and commit with `feat(admin): organize the native navigation`.

## 4. Add Dashboard widgets

- [x] Create `tests/int/admin-dashboard.int.spec.ts`. Check access-respecting counts and quote results, missing relations, per-widget failure isolation, setup visibility, quick-action permissions, system status redaction and the next pending job.
- [x] Run `corepack pnpm test:int tests/int/admin-dashboard.int.spec.ts` before implementing.
- [x] In `src/components/admin/dashboard/`, implement typed query functions and five corresponding server components. Put shared card styles in `Dashboard.module.css` and register the experimental layout through `dashboard/config.ts` and `src/payload.config.ts`. Gate admin-only work in both default layout and widget renderers since saved layouts can bypass the defaults.
- [x] Run `corepack pnpm generate:importmap`, `corepack pnpm generate:types` for the generated widget types, and the Dashboard test. Commit with `feat(admin): add operational dashboard widgets`.

## 5. Normalize public site branding

- [x] Create `tests/int/site-identity.int.spec.ts`. Check trimmed, partial and missing titles, Open Graph defaults, and source literals. Update `blog-site-integration.int.spec.ts`, `blog-category-seo.int.spec.ts`, `products-seo.int.spec.ts`, `settings.int.spec.ts`, `footer-adapter.int.spec.ts`, `blog-routes.int.spec.tsx` `logo.int.spec.tsx` and `generate-meta.int.spec.ts` where assumptions change.
- [x] Run `corepack pnpm test:int tests/int/{site-identity,blog-site-integration,blog-category-seo,products-seo,settings,footer-adapter,generate-meta}.int.spec.ts tests/int/{blog-routes,logo}.int.spec.tsx` before implementing.
- [x] Add `src/utilities/siteIdentity.ts` exporting `normalizeSiteIdentity`, `getSiteIdentity` and `formatTitle`. Use the request for SEO generation and the cached global for frontend metadata. Update `generateMeta.ts`, `mergeOpenGraph.ts`, `buildSiteMetadata.ts`, the locale layout, search and the blog and product Open Graph consumers.
- [x] Remove the Footer fallback and hide missing copyright text in `Footer/{adaptFooter.ts,types.ts,Component.tsx}`. Move the upload fixture in `tests/e2e/blogs.e2e.spec.ts` to an existing test WebP, then remove `public/website-template-OG.webp`. Keep the historical static demo as a record of its captured output.
- [x] Re-run the named integration files and commit with `fix(site): derive branding from site settings`.

## 6. Verify Admin in Chromium

- [x] Extend `tests/e2e/admin.e2e.spec.ts` for the login fallback, widgets, and dark-mode computed accent. Use explicit light/dark browser contexts and the existing isolated server and account fixture. Capture login, Dashboard, list and edit to `/tmp/admin-ui-shots/` with an opt-in environment flag.
- [x] Run `DISABLE_R2_STORAGE=true ADMIN_UI_SCREENSHOTS=true corepack pnpm test:e2e tests/e2e/admin.e2e.spec.ts`. Compare the captures with demo v2, inspect the mounted secondary and tertiary surfaces, and calibrate only `--admin-*` values.
- [x] Run `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm lint` and `corepack pnpm build` against the isolated test configuration. Keep build output separate from the running dev server. Commit with `test(admin): verify branded admin in Chromium`.

## Canary.29 findings

- The native sidebar does not consume `graphics.Icon`. Render the same brand graphic in `beforeNavLinks` and keep the native navigation.
- The first-user view has no logo slot. Preserve the native first-user form and apply the shared theme.
- The anonymous client config drops `admin.theme`. Initialize automatic mode with the public theme hook when no manual preference cookie exists.
- Native navigation lists collections before globals. Collection and global membership match the requested groups.
- Dashboard width percentages require `large + small` for the two-card administrator row. Widget contents and the default layout enforce roles. The native widget picker lists every registered widget.

## Results

- Targeted Vitest run passed 154 cases across 13 files.
- The isolated Chromium admin suite passed all five cases. The eight captures and computed-background reports are under `/tmp/admin-ui-shots/`.
- TypeScript, lint and the isolated production build passed. Lint reported 18 existing warnings.
- Screenshot calibration changed the light secondary fill to `#f4f4f6` and the dark elevated fill to `#2b2b2e`. The semantic mapping stayed intact.
