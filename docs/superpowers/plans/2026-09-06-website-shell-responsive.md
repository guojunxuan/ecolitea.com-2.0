# Website Shell Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the responsive Ecolitea Website shell with one public brand theme, an adaptive desktop Header and Mega Menu, shared Tablet/Mobile three-level navigation, and a CMS-backed responsive Footer with a disabled newsletter placeholder.

**Architecture:** Keep the App Router Root Layout and CMS data loaders as Server Components, then pass serializable, Payload-named render data into small client interaction boundaries. Extend the existing `Header/Nav`, `Footer`, `components/Link`, `components/Logo`, and global CSS owners; do not add a parallel shell or design-system directory. Header and Footer share one `1170px` structural handoff and one 1220px site-container contract.

**Tech Stack:** Next.js 16.3 App Router, React 19.2, Payload CMS 4 canary, TypeScript 6, Tailwind CSS 4, Vitest/Testing Library, Playwright.

---

## Implementation constraints

- Work only in `/Users/jason/ecolitea.com 2.0/.worktrees/codex-site-settings` on `codex/site-settings`.
- Preserve the user's existing Social Platform changes. Never stage them with these tasks.
- Before editing a Next.js concern, follow the checked-in documentation under `node_modules/next/dist/docs/`; relevant starting points are `01-app/03-api-reference/03-file-conventions/layout.md`, `01-app/02-guides/server-and-client-boundary.md`, and `01-app/03-api-reference/02-components/link.md`.
- Keep Payload field vocabulary: `navItems`, `navigationType`, `dropdown`, `items`, `link`, `reference`, `url`, `newTab`, `menuCta`, `columns`, and `siteSettings`.
- Do not change Payload Header, Footer, Site Settings, or Social Platform schemas.
- Do not change `package.json` or `pnpm-lock.yaml` for theme removal or shell implementation.
- Use test-first steps and stage only the listed files for each commit.

## File map

### Delete

- `src/providers/Theme/index.tsx`, `shared.ts`, `types.ts`, `InitTheme/index.tsx`, `ThemeSelector/index.tsx`, and `ThemeSelector/types.ts`: obsolete public theme feature.
- `src/providers/HeaderTheme/index.tsx`: obsolete section-driven Header theme state.
- The five frontend `page.client.tsx` files under `[slug]`, `posts`, paginated posts, post detail, and search: they only set Header theme.

### Create under existing owners

- `src/Header/Nav/types.ts`: serializable Header render-data types using Payload vocabulary.
- `src/Header/Nav/adaptNavigation.ts`: active-branch adapter and label synthesis.
- `src/Header/Nav/navigationState.ts`: pure non-desktop navigation state/reducer.
- `src/Header/Nav/DesktopNav.tsx`: desktop navigation and overflow owner.
- `src/Header/Nav/DesktopMegaMenu.tsx`: desktop menu presentation.
- `src/Header/Nav/MobileNav.tsx`: shared Tablet/Mobile full-screen navigation.
- `src/Header/Nav/index.module.css`: Header navigation styles colocated with the current `Nav` owner.
- `src/Footer/types.ts`: Footer render-data types.
- `src/Footer/adaptFooter.ts`: Footer/Site Settings adapter.
- `src/Footer/Navigation.client.tsx`: single-open non-desktop accordion.
- `src/Footer/index.module.css`: explicit Footer dark-surface and responsive styles.
- Focused integration tests under `tests/int/` and one shell E2E spec under `tests/e2e/`.

### Modify

- `src/app/(frontend)/layout.tsx`, `globals.css`, and affected page routes.
- `src/providers/index.tsx`.
- `src/Header/Component.tsx`, `Component.client.tsx`, and `Nav/index.tsx`.
- `src/Footer/Component.tsx`.
- `src/components/Link/index.tsx`, `components/RichText/index.tsx`, and frontend UI primitives containing `dark:` variants.
- `src/heros/HighImpact/index.tsx`.
- `tests/int/logo.int.spec.tsx`.

## Task 1: Remove the public theme runtime and establish the shell contract

**Files:**
- Create: `tests/int/website-shell.int.spec.tsx`
- Modify: `src/app/(frontend)/layout.tsx`
- Modify: `src/providers/index.tsx`

- [ ] **Step 1: Write a source-level shell test that locks the removal boundary**

Create `tests/int/website-shell.int.spec.tsx` with assertions that read the frontend layout, provider entry, and global CSS as text. Assert that the layout contains `<Header />`, `<main id="main-content">{children}</main>`, and `<Footer />`; does not contain `AdminBar`, `InitTheme`, or `data-theme`; and that the provider entry contains neither `ThemeProvider` nor `HeaderThemeProvider`.

```tsx
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (file: string) => fs.readFileSync(path.resolve(process.cwd(), file), 'utf8')

describe('public Website shell', () => {
  it('renders Header, main, and Footer without the public theme runtime or Admin Bar', () => {
    const layout = read('src/app/(frontend)/layout.tsx')
    const providers = read('src/providers/index.tsx')

    expect(layout).toContain('<Header />')
    expect(layout).toContain('<main id="main-content">{children}</main>')
    expect(layout).toContain('<Footer />')
    expect(layout).not.toMatch(/AdminBar|InitTheme|data-theme/)
    expect(providers).not.toMatch(/ThemeProvider|HeaderThemeProvider/)
  })
})
```

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `corepack pnpm exec vitest run tests/int/website-shell.int.spec.tsx`

Expected: FAIL because the current layout still mounts Admin Bar and InitTheme and does not own the `main` landmark.

- [ ] **Step 3: Simplify the Root Layout and providers**

Keep metadata generation and favicon resolution intact. Remove the Admin Bar import, `draftMode()` call used only by it, InitTheme import/render, and manual `<head>`. Render:

```tsx
<html className={cn(GeistSans.variable, GeistMono.variable)} lang="en">
  <body>
    <Providers>
      <Header />
      <main id="main-content">{children}</main>
      <Footer />
    </Providers>
  </body>
</html>
```

If `Providers` has no remaining provider after later searches, make it a fragment-returning compatibility component for this commit; remove the wrapper entirely only when all imports can change in the same safe step.

- [ ] **Step 4: Keep the now-unmounted modules until their remaining consumers are removed**

Do not delete the Theme or HeaderTheme modules in this task because Header, Footer, Heroes, and page bridge components still import them. This commit must remain buildable. Do not edit Payload Admin layout or Admin CSS.

- [ ] **Step 5: Run the focused test and static reference scan**

Run:

```bash
corepack pnpm exec vitest run tests/int/website-shell.int.spec.tsx
rg -n "ThemeProvider|HeaderThemeProvider|ThemeSelector|InitTheme|themeLocalStorageKey|prefers-color-scheme" src
```

Expected: test PASS. The scan still reports imports in Header, Footer, Heroes, and page clients; Task 2 removes them together with the obsolete modules.

- [ ] **Step 6: Commit the runtime removal boundary**

```bash
git add 'src/app/(frontend)/layout.tsx' src/providers tests/int/website-shell.int.spec.tsx
git commit -m "refactor: remove public theme runtime"
```

## Task 2: Remove page-level Header theme bridges and dark variants

**Files:**
- Modify: `src/Header/Component.client.tsx`
- Modify: `src/Footer/Component.tsx`
- Modify: `src/heros/HighImpact/index.tsx`
- Modify: `src/components/RichText/index.tsx`
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/checkbox.tsx`
- Modify: `src/components/ui/input.tsx`
- Modify: `src/components/ui/select.tsx`
- Modify: `src/components/ui/textarea.tsx`
- Modify: `src/app/(frontend)/[slug]/page.tsx`
- Modify: `src/app/(frontend)/posts/page.tsx`
- Modify: `src/app/(frontend)/posts/page/[pageNumber]/page.tsx`
- Modify: `src/app/(frontend)/posts/[slug]/page.tsx`
- Modify: `src/app/(frontend)/search/page.tsx`
- Delete: the corresponding five `page.client.tsx` files.
- Modify: `tests/int/logo.int.spec.tsx`
- Delete: `src/providers/Theme/index.tsx`
- Delete: `src/providers/Theme/shared.ts`
- Delete: `src/providers/Theme/types.ts`
- Delete: `src/providers/Theme/InitTheme/index.tsx`
- Delete: `src/providers/Theme/ThemeSelector/index.tsx`
- Delete: `src/providers/Theme/ThemeSelector/types.ts`
- Delete: `src/providers/HeaderTheme/index.tsx`

- [ ] **Step 1: Extend the shell test with a complete public-theme reference scan**

Add a recursive scan of `src/app/(frontend)`, `src/Header`, `src/Footer`, `src/heros`, and `src/components` and assert it contains none of:

```ts
const forbidden = [
  'useHeaderTheme',
  'setHeaderTheme',
  'ThemeSelector',
  'data-theme=',
  'dark:',
  'dark:prose-invert',
]
```

Exclude `src/blocks/Code/Component.client.tsx` from checks for `vsDark`; Prism syntax highlighting is explicitly allowed.

- [ ] **Step 2: Run the test and confirm the exact references fail**

Run: `corepack pnpm exec vitest run tests/int/website-shell.int.spec.tsx`

Expected: FAIL listing current Header, Footer, Hero, RichText, page, and UI primitive references.

- [ ] **Step 3: Remove Header/Footer/Hero theme behavior**

In Header, remove theme hooks/state and always select the primary Logo. In Footer, remove ThemeSelector but keep `selectLogo(primary, inverse, true)` because inverse artwork is still used on a fixed dark surface. In HighImpact, remove `'use client'`, effects, `data-theme`, and negative Header overlap; keep explicit foreground styling local to the Hero.

- [ ] **Step 4: Delete page bridge components and imports**

Remove every `PageClient` import and JSX node from its page route, then delete the five files. Do not remove `LivePreviewListener`.

- [ ] **Step 5: Collapse frontend styling to one public theme**

Remove `dark:prose-invert` and all UI primitive `dark:` alternatives. Keep the base semantic classes and their accessible focus/error states. Update `logo.int.spec.tsx` to remove HeaderThemeProvider setup and inverse-Header assertions while preserving inverse Footer Logo fallback coverage. Delete the seven Theme/HeaderTheme module files only after the last import is removed.

- [ ] **Step 6: Run tests and type checking**

Run:

```bash
corepack pnpm exec vitest run tests/int/website-shell.int.spec.tsx tests/int/logo.int.spec.tsx
corepack pnpm exec tsc --noEmit --incremental false
```

Expected: PASS except known current Footer/Header schema consumer failures that are resolved in later tasks; record only those exact failures in the plan checklist before continuing.

- [ ] **Step 7: Commit**

Stage only the files in this task and commit:

```bash
git commit -m "refactor: standardize public website colors"
```

## Task 3: Build the global container and responsive token system

**Files:**
- Modify: `src/app/(frontend)/globals.css`
- Modify: `tests/int/website-shell.int.spec.tsx`

- [ ] **Step 1: Add failing token and breakpoint assertions**

Assert that global CSS defines these public contracts and contains no `[data-theme='dark']`, theme opacity gate, or dark custom variant:

```css
--site-max-width: 76.25rem;
--reading-max-width: 46rem;
--header-height: 3.75rem;
--section-space-compact: clamp(...);
--section-space-standard: clamp(...);
--section-space-spacious: clamp(...);
```

Also assert the desktop media query is exactly `@media (width >= 73.125rem)` (1170px).

- [ ] **Step 2: Run the test and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/website-shell.int.spec.tsx`

- [ ] **Step 3: Replace the template theme and container definitions**

Keep one light semantic token set. Define site, wide, reading, Header height, gutter, and three section-spacing variables. Preserve error/success/warning tokens used by Forms. Implement reusable classes under `@layer utilities`:

```css
.site-container { width: min(100% - (2 * var(--site-gutter)), var(--site-max-width)); margin-inline: auto; }
.wide-container { width: min(100% - (2 * var(--site-gutter)), var(--wide-max-width)); margin-inline: auto; }
.reading-container { width: min(100% - (2 * var(--site-gutter)), var(--reading-max-width)); margin-inline: auto; }
```

Use 16px Mobile gutter, 32px Tablet gutter, and 40–48px Desktop gutter. At 1170px, set desktop Header height to 5.625rem; Wide changes outer whitespace only.

- [ ] **Step 4: Verify tests and Tailwind compilation**

Run:

```bash
corepack pnpm exec vitest run tests/int/website-shell.int.spec.tsx
corepack pnpm exec tsc --noEmit --incremental false
```

- [ ] **Step 5: Commit**

```bash
git add 'src/app/(frontend)/globals.css' tests/int/website-shell.int.spec.tsx
git commit -m "feat: add responsive website layout tokens"
```

## Task 4: Generalize CMS Link resolution without changing Payload fields

**Files:**
- Create: `tests/int/cms-link.int.spec.tsx`
- Modify: `src/components/Link/index.tsx`

- [ ] **Step 1: Write failing tests for every configured relationship target**

Cover populated Page, Post, Case Study, and Category references plus Custom URL and `newTab`. Expected hrefs:

```ts
pages: '/about'
posts: '/posts/example-post'
caseStudies: '/case-studies/example-case'
categories: '/posts?category=example-category'
```

Use the existing `reference.relationTo` and `reference.value` Payload shape. Assert an unpopulated relationship ID and a missing slug render nothing rather than creating a broken href.

- [ ] **Step 2: Run the test and confirm the current pages/posts type fails**

Run: `corepack pnpm exec vitest run tests/int/cms-link.int.spec.tsx`

- [ ] **Step 3: Implement one reusable resolver in the existing Link owner**

Export a pure `resolveLinkHref(link)` beside `CMSLink`. Type `reference.relationTo` with the four existing collection slugs and type `value` with the corresponding generated documents or IDs. Use a `switch` over `relationTo`; do not infer paths from plural names. Keep `CMSLink` props named after Payload fields.

- [ ] **Step 4: Run focused tests**

Run: `corepack pnpm exec vitest run tests/int/cms-link.int.spec.tsx tests/int/logo.int.spec.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Link/index.tsx tests/int/cms-link.int.spec.tsx
git commit -m "feat: resolve all configured CMS links"
```

## Task 5: Adapt Header Global data into stable render data

**Files:**
- Create: `src/Header/Nav/types.ts`
- Create: `src/Header/Nav/adaptNavigation.ts`
- Create: `tests/int/header-navigation-adapter.int.spec.ts`

- [ ] **Step 1: Write failing active-branch adapter tests**

Build fixtures for `directLink`, `dropdown`, and `directLinkAndDropdown`; Default, Featured, and List items; optional rich content; enabled/disabled CTA; malformed destinations; and populated relationships. Assert inactive group values are ignored.

The expected render data preserves Payload names:

```ts
type HeaderNavigationData = {
  navItems: HeaderNavigationItem[]
  menuCta: HeaderLinkData | null
}

type HeaderNavigationItem = {
  id: string
  label: string
  navigationType: 'directLink' | 'dropdown' | 'directLinkAndDropdown'
  link: HeaderLinkData | null
  dropdown: HeaderDropdownData | null
}
```

Nested `items` retain `type`, `defaultItem`, `featuredItem`, and `listItem`; links add only resolved `href` and synthesized visible labels where their Payload link intentionally has no label.

- [ ] **Step 2: Run the tests and confirm the adapter is missing**

Run: `corepack pnpm exec vitest run tests/int/header-navigation-adapter.int.spec.ts`

- [ ] **Step 3: Implement the minimal pure adapter**

Use `resolveLinkHref` from `components/Link`. Return no functions or React elements so the result remains serializable across the Server/Client boundary. Filter malformed content at the smallest row, not the whole Header.

- [ ] **Step 4: Run focused tests and type checking**

Run:

```bash
corepack pnpm exec vitest run tests/int/header-navigation-adapter.int.spec.ts tests/int/cms-link.int.spec.tsx
corepack pnpm exec tsc --noEmit --incremental false
```

- [ ] **Step 5: Commit**

```bash
git add src/Header/Nav/types.ts src/Header/Nav/adaptNavigation.ts tests/int/header-navigation-adapter.int.spec.ts
git commit -m "feat: adapt header navigation data"
```

## Task 6: Implement desktop Header, Mega Menu, and overflow

**Files:**
- Create: `src/Header/Nav/DesktopNav.tsx`
- Create: `src/Header/Nav/DesktopMegaMenu.tsx`
- Create: `src/Header/Nav/index.module.css`
- Create: `tests/int/header-desktop.int.spec.tsx`
- Modify: `src/Header/Nav/index.tsx`

- [ ] **Step 1: Write failing desktop interaction tests**

Test that direct links render as links, dropdown rows render buttons, and hybrid rows render a direct text link plus a separately named menu button. Assert one menu opens at a time, Escape closes, Description Links and all three item types render, and CTA/search remain available.

Add an overflow test with eight long `navItems`: mock element measurements/ResizeObserver and assert trailing items move under a `More` button without being duplicated or dropped.

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/header-desktop.int.spec.tsx`

- [ ] **Step 3: Implement DesktopNav state and semantics**

Keep state inside `DesktopNav`; accept `navItems` and `menuCta`. Use links for destinations and buttons for disclosure. Provide `aria-expanded`, `aria-controls`, named chevron buttons, Escape handling, route-change reset using `usePathname`, and outside-close cleanup.

- [ ] **Step 4: Implement the editorial Mega Menu**

Render a full-width menu surface with a nested `.site-container`. Preserve the order of `descriptionLinks` and `items`. Render Featured rich content through the existing RichText component with `enableGutter={false}` and Header-scoped typography.

- [ ] **Step 5: Implement measured overflow**

Measure available navigation width after reserving Logo and actions. Keep a hidden measurement row inside the Header owner, recalculate through ResizeObserver, and expose all overflowed items through `More`. When ResizeObserver is unavailable, use a conservative CSS-safe fallback that leaves items accessible.

- [ ] **Step 6: Run tests**

Run: `corepack pnpm exec vitest run tests/int/header-desktop.int.spec.tsx tests/int/header-navigation-adapter.int.spec.ts`

- [ ] **Step 7: Commit**

```bash
git add src/Header/Nav tests/int/header-desktop.int.spec.tsx
git commit -m "feat: build desktop header navigation"
```

## Task 7: Implement shared Tablet/Mobile three-level navigation

**Files:**
- Create: `src/Header/Nav/navigationState.ts`
- Create: `src/Header/Nav/MobileNav.tsx`
- Create: `tests/int/header-mobile-navigation.int.spec.tsx`
- Modify: `src/Header/Nav/index.module.css`

- [ ] **Step 1: Write failing reducer tests**

Define and test these actions:

```ts
type NavigationAction =
  | { type: 'openDropdown'; navItemIndex: number }
  | { type: 'openItem'; itemIndex: number }
  | { type: 'back' }
  | { type: 'reset' }
```

Assert `1 → 2 → 3 → 2 → 1`, invalid third-level transitions are ignored, and reset clears active indexes.

- [ ] **Step 2: Write failing component tests**

Test full-screen open/close, Direct Link activation, hybrid Overview placement, Default direct links, Featured/List third levels, Back focus restoration, Escape, route reset, body scroll restoration, CTA, and the 1170px desktop transition reset.

- [ ] **Step 3: Run and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/header-mobile-navigation.int.spec.tsx`

- [ ] **Step 4: Implement the pure reducer and MobileNav**

Use one component for both Tablet and Mobile; do not branch DOM by device name. Render all panels inside one translated track, keep panel headings and Back controls explicit, and store the element to refocus after Back/close.

- [ ] **Step 5: Implement lifecycle safety**

Lock body scroll only while open and restore the previous inline value during every close/unmount path. Add a `matchMedia('(min-width: 73.125rem)')` listener to reset and close at Desktop. Respect `prefers-reduced-motion: reduce` in CSS.

- [ ] **Step 6: Run focused tests**

Run: `corepack pnpm exec vitest run tests/int/header-mobile-navigation.int.spec.tsx tests/int/header-desktop.int.spec.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/Header/Nav/navigationState.ts src/Header/Nav/MobileNav.tsx src/Header/Nav/index.module.css tests/int/header-mobile-navigation.int.spec.tsx
git commit -m "feat: add full-screen responsive navigation"
```

## Task 8: Integrate Header server data, branding, and fixed shell behavior

**Files:**
- Modify: `src/Header/Component.tsx`
- Modify: `src/Header/Component.client.tsx`
- Modify: `src/Header/Nav/index.tsx`
- Modify: `tests/int/logo.int.spec.tsx`
- Create: `tests/int/header-component.int.spec.tsx`

- [ ] **Step 1: Write failing integration tests**

Mock `getCachedGlobal` and assert Header fetches `header` and `site-settings` concurrently at depth 1, resolves the primary Logo, adapts navigation once on the server, and passes serializable props to HeaderClient. Assert Site Name renders when Logo cannot resolve.

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/header-component.int.spec.tsx tests/int/logo.int.spec.tsx`

- [ ] **Step 3: Implement server integration**

Use the existing `Promise.all` pattern. Select the primary Logo for Header, keep inverse Logo resolution for Footer only, and pass `siteName`, `logo`, `navItems`, and `menuCta` to HeaderClient.

- [ ] **Step 4: Implement fixed Header presentation**

HeaderClient composes Logo/home link, DesktopNav, and MobileNav. It may track only scroll state needed for the divider/elevation cue. It must not track a theme or import Payload server code.

- [ ] **Step 5: Verify**

Run:

```bash
corepack pnpm exec vitest run tests/int/header-component.int.spec.tsx tests/int/header-desktop.int.spec.tsx tests/int/header-mobile-navigation.int.spec.tsx tests/int/logo.int.spec.tsx
corepack pnpm exec tsc --noEmit --incremental false
```

- [ ] **Step 6: Commit**

```bash
git add src/Header tests/int/header-component.int.spec.tsx tests/int/logo.int.spec.tsx
git commit -m "feat: integrate responsive website header"
```

## Task 9: Adapt Footer and Site Settings data

**Files:**
- Create: `src/Footer/types.ts`
- Create: `src/Footer/adaptFooter.ts`
- Create: `tests/int/footer-adapter.int.spec.ts`

- [ ] **Step 1: Write failing adapter tests**

Cover four `columns`, Custom and populated relationship links, empty columns, primary/inverse Logo fallback, Site Name fallback, partial contact fields, social relationships, legal page relationships, and copyright fallback. Assert legacy top-level `footer.navItems` is ignored.

Use Payload vocabulary in the result:

```ts
type FooterData = {
  siteName: string
  logo: LogoImage | null
  siteDescription: string | null
  socialLinks: SocialLinkData[]
  columns: FooterColumnData[]
  contact: ContactData
  legalLinks: FooterLinkData[]
  copyrightText: string
}
```

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/footer-adapter.int.spec.ts`

- [ ] **Step 3: Implement pure Footer adaptation**

Resolve inverse Logo with `selectLogo(primary, inverse, true)`. Resolve Footer links through the shared Link owner. Accept already-populated Social Platform records only; skip unresolved platform IDs because icon/name data is unavailable at render depth. Generate copyright only when configured text is absent.

- [ ] **Step 4: Run focused tests**

Run: `corepack pnpm exec vitest run tests/int/footer-adapter.int.spec.ts tests/int/cms-link.int.spec.tsx`

- [ ] **Step 5: Commit**

```bash
git add src/Footer/types.ts src/Footer/adaptFooter.ts tests/int/footer-adapter.int.spec.ts
git commit -m "feat: adapt footer global data"
```

## Task 10: Build Desktop and shared Tablet/Mobile Footer

**Files:**
- Create: `src/Footer/Navigation.client.tsx`
- Create: `src/Footer/index.module.css`
- Create: `tests/int/footer-component.int.spec.tsx`
- Modify: `src/Footer/Component.tsx`

- [ ] **Step 1: Write failing Footer component tests**

Assert Footer fetches `footer` and `site-settings` concurrently, renders a dark explicit surface without `data-theme`, renders Desktop brand/navigation/information zones, and exposes all configured data. Assert the newsletter input and button are both disabled and no form action exists.

For the non-desktop navigation client, assert four accordion triggers, a single open column, 54px-target class contract, and accessible links when enhanced. Assert Tablet and Mobile use the same markup and the stylesheet contains no Tablet two-column navigation rule.

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/footer-component.int.spec.tsx`

- [ ] **Step 3: Implement the server Footer**

Fetch both Globals with `Promise.all`, adapt once, and render semantic brand, navigation, newsletter, address/contact, legal, and copyright sections. Keep Newsletter copy in one frozen module constant:

```ts
const newsletter = {
  heading: 'Stay informed',
  description: 'Product updates and practical insights.',
  placeholder: 'Email address',
  buttonLabel: 'Subscribe',
} as const
```

- [ ] **Step 4: Implement the non-desktop accordion**

Use one `openColumnID: string | null`; clicking the current column closes it and clicking another replaces it. Use buttons with `aria-expanded` and `aria-controls`. Keep a server-visible link baseline through rendered content and CSS enhancement rather than withholding all links until hydration.

- [ ] **Step 5: Implement responsive styles**

Desktop uses flexible 20/55/25 zones. Below exactly 1170px use one single-column sequence for both Tablet and Mobile. Tablet changes gutter/max width only. Do not add a 2×2 navigation grid.

- [ ] **Step 6: Run tests and type checking**

Run:

```bash
corepack pnpm exec vitest run tests/int/footer-adapter.int.spec.ts tests/int/footer-component.int.spec.tsx tests/int/logo.int.spec.tsx
corepack pnpm exec tsc --noEmit --incremental false
```

- [ ] **Step 7: Commit**

```bash
git add src/Footer tests/int/footer-component.int.spec.tsx
git commit -m "feat: build responsive website footer"
```

## Task 11: Align existing page and Block wrappers with the shell

**Files:**
- Modify: `src/blocks/RenderBlocks.tsx`
- Modify: `src/blocks/Content/Component.tsx`
- Modify: `src/blocks/ArchiveBlock/Component.tsx`
- Modify: `src/blocks/Form/Component.tsx`
- Modify: `src/components/CollectionArchive/index.tsx`
- Modify: `src/heros/LowImpact/index.tsx`
- Modify: `src/heros/MediumImpact/index.tsx`
- Modify: `src/app/(frontend)/[slug]/page.tsx`
- Modify: `src/app/(frontend)/posts/page.tsx`
- Modify: `src/app/(frontend)/posts/page/[pageNumber]/page.tsx`
- Modify: `src/app/(frontend)/posts/[slug]/page.tsx`
- Modify: `src/app/(frontend)/search/page.tsx`
- Modify: `src/app/(frontend)/not-found.tsx`
- Create: `tests/int/layout-primitives.int.spec.tsx`

- [ ] **Step 1: Write failing layout-contract tests**

Assert ordinary page sections use `site-container`, long-form content uses `reading-container`, and global section spacing replaces duplicate outer `my-16`. Assert no component applies a second fixed-Header offset or negative Header overlap.

- [ ] **Step 2: Run and confirm failure**

Run: `corepack pnpm exec vitest run tests/int/layout-primitives.int.spec.tsx`

- [ ] **Step 3: Migrate only shell-facing wrappers**

Replace legacy container/margin utilities at the owning wrapper. Do not redesign Block contents or change Payload fields. Preserve explicit full-bleed media behavior through `wide-container` or `viewport` only where the current component already requests it.

- [ ] **Step 4: Run focused and full integration tests**

Run:

```bash
corepack pnpm exec vitest run tests/int/layout-primitives.int.spec.tsx
corepack pnpm test:int
corepack pnpm exec tsc --noEmit --incremental false
```

- [ ] **Step 5: Commit**

Stage only the listed page/Block wrapper changes and commit:

```bash
git commit -m "refactor: align pages with website shell"
```

## Task 12: Add responsive end-to-end verification

**Files:**
- Create: `tests/e2e/website-shell.e2e.spec.ts`
- Verify: `playwright.config.ts`

- [ ] **Step 1: Write the E2E spec**

At 390px, 834px, 1170px, and 1440px viewports, verify:

- no horizontal page overflow;
- Header remains visible and main content is not obscured;
- 390px and 834px use the same full-screen navigation and three-level path;
- Back, Escape, close, route navigation, focus restoration, and body-scroll restoration work;
- 1170px and 1440px use Desktop navigation and Mega Menu;
- hybrid text and chevron perform different actions;
- Footer uses accordion structure at 390px and 834px;
- Footer uses three zones at 1170px and 1440px;
- Newsletter controls are disabled;
- no Theme Selector or `data-theme` attribute exists;
- emulated dark OS preference does not change public colors.

- [ ] **Step 2: Run the E2E test and diagnose any fixture prerequisite**

Run: `corepack pnpm test:e2e -- tests/e2e/website-shell.e2e.spec.ts`

Expected: PASS against a test-owned published Page created in `beforeAll` through the existing Payload test helper pattern and deleted in `afterAll`. Use a unique slug prefixed `e2e-website-shell-`; do not depend on or mutate persistent developer content.

- [ ] **Step 3: Run responsive visual review**

Capture screenshots for all four viewports and compare Header, open menus, content alignment, and Footer against the approved UI direction. Fix only contract deviations; do not expand into page-content redesign.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/website-shell.e2e.spec.ts
git commit -m "test: cover responsive website shell"
```

## Task 13: Final verification and architecture audit

**Files:**
- Verify all files changed by Tasks 1–12.
- Update this plan's checkboxes only as work completes.

- [ ] **Step 1: Verify forbidden theme references**

Run:

```bash
rg -n "ThemeProvider|HeaderThemeProvider|ThemeSelector|InitTheme|themeLocalStorageKey|prefers-color-scheme|data-theme=|dark:" 'src/app/(frontend)' src/Header src/Footer src/heros src/components
```

Expected: no public theme feature references. Explicit fixed dark colors and Prism `themes.vsDark` may remain.

- [ ] **Step 2: Verify dependencies and Payload schema stability**

Run:

```bash
git diff main...HEAD -- package.json pnpm-lock.yaml src/Header/config.ts src/Header/fields src/Footer/config.ts src/SiteSettings
```

Expected: no dependency or schema change attributable to the Website shell. Ignore pre-existing Social Platform worktree changes when assessing the diff.

- [ ] **Step 3: Run the full validation suite**

Run:

```bash
corepack pnpm lint
corepack pnpm test:int
corepack pnpm test:e2e
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm build
```

Expected: all commands exit 0.

- [ ] **Step 4: Inspect the final diff and worktree ownership**

Run:

```bash
git diff --check
git status --short
git log --oneline --decorate -15
```

Expected: no shell work remains unstaged, no whitespace errors, and the user's unrelated Social Platform files remain uncommitted and unaltered unless the user separately changed their status.

- [ ] **Step 5: Request code review**

Invoke `superpowers:requesting-code-review` and review the complete implementation against `docs/superpowers/specs/2026-09-06-website-shell-responsive-design.md`. Resolve every blocking issue and rerun the affected validation.

- [ ] **Step 6: Complete using the branch-finishing workflow**

Invoke `superpowers:verification-before-completion`, then `superpowers:finishing-a-development-branch`. Do not merge, push, or delete the worktree without the user's explicit choice.
