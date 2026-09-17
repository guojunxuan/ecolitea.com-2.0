# Header Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变 Payload Header 数据模型的前提下，实现已确认的桌面透明 Header、磨砂 Mega Menu、右侧优先横向导航、内容 Block 视觉系统和移动端同面板手风琴。

**Architecture:** `Header` Server Component 继续并行读取 Payload Global 并传递稳定 presentation model。浏览器滚动与导航开合状态由最小的 Client Components 管理：`HeaderClient` 只负责 Header surface，`DesktopNav` 负责桌面菜单、overflow、indicator 与遮罩，`MobileNav` 负责移动手风琴和页面滚动锁定。Block 数据契约不变，只重组现有 JSX 和 CSS Modules。

**Tech Stack:** Next.js 16.3.3 App Router, React 19.2, TypeScript 6, Payload 4 canary, CSS Modules, Tailwind 4, lucide-react, Vitest, Testing Library, Playwright.

---

## Repository Guardrails

- 每次开始代码修改前阅读仓库根目录 `AGENTS.md`。
- 修改 Client Component/CSS 前参考安装版本文档：
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/11-css.md`
  - `node_modules/next/dist/docs/03-architecture/accessibility.md`
- 不修改 `src/payload-types.ts`、Admin import map、Payload schema、锁文件或 Header 内容数据。
- 当前工作区已有 Header 相关未提交改动；实现时基于当前文件逐段修改，不回退或覆盖不属于本任务的变更。
- `.playwright-cli/`、`output/` 和浏览器临时产物不得提交。

## File Ownership

- Create: `src/Header/Component.module.css` — Header 顶部透明、滚动、菜单打开和移动端 surface 状态。
- Modify: `src/Header/Component.client.tsx` — 30px 滚动阈值与 desktop/mobile 菜单开合状态汇总。
- Modify: `src/Header/Nav/index.tsx` — 将开合状态回传给 `HeaderClient`。
- Modify: `src/Header/Nav/DesktopNav.tsx` — 桌面触发器、hover intent、键盘、横向 overflow、indicator、遮罩和关闭边界。
- Modify: `src/Header/Nav/DesktopMegaMenu.tsx` — 面板语义与唯一滚动区域。
- Modify: `src/Header/Nav/MobileNav.tsx` — 同面板一级手风琴、汉堡变形、固定底部 CTA。
- Modify: `src/Header/Nav/navigationState.ts` — 单一一级展开项与每个 Category Block 的单一展开项。
- Modify: `src/Header/Nav/CategoryTabs.tsx` — hover intent、最大分类高度、Sticky Category 与 CTA 位置。
- Modify: `src/Header/Nav/NavigationBlocks.tsx` — Block 标题行、CTA、分区和既有顺序。
- Modify: `src/Header/Nav/NavigationCard.tsx` — product/visual/rich 三种卡片结构。
- Modify: `src/Header/Nav/index.module.css` — 桌面和移动导航布局、Mega Menu 与遮罩、动画。
- Modify: `src/Header/Nav/blocks.module.css` — Category、Card、Card Group、Link Group、Rich Card 样式。
- Modify: focused Header tests under `tests/int/` and `tests/e2e/website-shell.e2e.spec.ts`.

### Task 1: Lock the Current Baseline and Replace Obsolete Expectations

**Files:**
- Test: `tests/int/header-component.int.spec.tsx`
- Test: `tests/int/header-desktop.int.spec.tsx`
- Test: `tests/int/header-mobile-navigation.int.spec.tsx`
- Test: `tests/int/header-block-rendering.int.spec.tsx`

- [ ] **Step 1: Record the working-tree baseline.**

Run:

```bash
git status --short
git diff -- src/Header tests/int/header-*.spec.tsx tests/e2e/website-shell.e2e.spec.ts
```

Expected: existing Header work is visible and preserved; no reset or checkout is performed.

- [ ] **Step 2: Replace assertions that directly conflict with the approved design.**

Update tests so they no longer require:

```text
fixed light Header at page top
Hybrid destination and disclosure as separate desktop controls
mobile root -> independent section view -> Back navigation
root-end mobile CTA inside the scrolling list
visual-card lower-right ArrowUpRight icon
```

Add assertions for these stable contracts instead:

```tsx
expect(headerSurface).toHaveAttribute('data-scrolled', 'false')
expect(headerSurface).toHaveAttribute('data-menu-open', 'false')
expect(screen.queryByLabelText('Accessories menu')).not.toBeInTheDocument()
expect(screen.getByRole('button', { name: 'Open Products' })).toHaveAttribute(
  'aria-expanded',
  'false',
)
expect(screen.getByTestId('mobile-navigation-root')).toContainElement(
  screen.getByText('Shop Insta360'),
)
```

- [ ] **Step 3: Run the focused tests and confirm they fail for the intended missing behavior.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/header-component.int.spec.tsx \
  tests/int/header-desktop.int.spec.tsx \
  tests/int/header-mobile-navigation.int.spec.tsx \
  tests/int/header-block-rendering.int.spec.tsx
```

Expected: failures refer to new surface states, accordion behavior, CTA placement, or card structure; no unrelated Payload/data failure.

### Task 2: Implement the Header Surface State Contract

**Files:**
- Create: `src/Header/Component.module.css`
- Modify: `src/Header/Component.client.tsx`
- Modify: `src/Header/Nav/index.tsx`
- Modify: `src/Header/Nav/DesktopNav.tsx`
- Modify: `src/Header/Nav/MobileNav.tsx`
- Test: `tests/int/header-component.int.spec.tsx`

- [ ] **Step 1: Add tests for the four state transitions.**

Cover these cases:

```text
Desktop top + closed       -> transparent
Desktop scrolled or open   -> 90% white
Mobile top + closed        -> transparent
Mobile scrolled or open    -> 100% white
```

Simulate `window.scrollY = 31`, dispatch `scroll`, and assert `data-scrolled="true"`. Open each navigation and assert `data-menu-open="true"`.

- [ ] **Step 2: Add a menu-open callback to the navigation boundary.**

Use this explicit contract:

```ts
type HeaderNavProps = HeaderNavigationData & {
  logo?: LogoImage | null
  onOpenChange?: (open: boolean) => void
  siteName?: string
}
```

`DesktopNav` and `MobileNav` call `onOpenChange` only when their own interactive state changes. `HeaderClient` stores the active state and emits `data-menu-open`.

- [ ] **Step 3: Implement the 30px scroll threshold with one passive listener.**

The effect should set:

```ts
const updateScrolled = () => setScrolled(window.scrollY > 30)
```

Clean up the listener on unmount. Avoid moving global content or adding server-side browser checks.

- [ ] **Step 4: Remove the Header layout spacer and add scoped surface styles.**

The rendered shell should follow this structure:

```tsx
<header className={styles.header}>
  <div
    className={styles.surface}
    data-menu-open={menuOpen ? 'true' : 'false'}
    data-scrolled={scrolled ? 'true' : 'false'}
  >
    <div className={`site-container ${styles.inner}`}>...</div>
  </div>
</header>
```

Desktop uses transparent/90% white states. Mobile overrides open/scrolled states to 100% white. Keep text, logo, and icons fully opaque.

- [ ] **Step 5: Run the focused component test.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-component.int.spec.tsx
```

Expected: all Header server-boundary and surface-state tests pass.

### Task 3: Rebuild Desktop Trigger, Overflow, and Indicator Behavior

**Files:**
- Modify: `src/Header/Nav/DesktopNav.tsx`
- Modify: `src/Header/Nav/index.module.css`
- Test: `tests/int/header-desktop.int.spec.tsx`

- [ ] **Step 1: Add focused tests for trigger semantics.**

Verify:

```text
pure dropdown: one text button, no chevron
hybrid: one text link, no separate disclosure button
hybrid hover opens; hybrid click remains a link
ArrowDown on hybrid opens its menu
Enter/Space toggles pure dropdown
```

- [ ] **Step 2: Replace `Trigger` with one visual control per item.**

Direct links render `NavigationLink`. Hybrid items render one `NavigationLink` with pointer/focus keyboard handlers. Dropdown items render one text-only `button`. Remove `ChevronDown`, `.hybridControl`, and `.disclosureButton` from desktop rendering and CSS.

- [ ] **Step 3: Add initial-open and close timers.**

Use refs for the timers:

```ts
const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
```

When no menu is open, pointer entry schedules open at `100ms`. When a menu is already open, switching is immediate. Leaving the combined navigation + Mega Menu region schedules close at `200ms`; re-entering cancels it.

- [ ] **Step 4: Initialize an overflowing strip at the right edge.**

After `ResizeObserver` measurement, when the strip first becomes overflowing for the current nav data, set:

```ts
strip.scrollLeft = strip.scrollWidth - strip.clientWidth
```

Preserve user scroll on later measurements. Arrow clicks target adjacent complete items, not fixed pixels. Keep Search and CTA outside the strip.

- [ ] **Step 5: Implement the shared indicator.**

Keep a single absolutely positioned element:

```tsx
<span
  aria-hidden="true"
  className={styles.navigationIndicator}
  style={{ transform: `translateX(${left}px)`, width }}
/>
```

Calculate `left` from the item and navigation frame bounding rectangles, including horizontal scroll. Update on pointer/focus, open item changes, strip scroll, and resize. Hide after the approved `200ms` leave delay.

- [ ] **Step 6: Add overflow framing.**

In CSS, keep the track `min-width: max-content`, add fixed `32px` arrow controls and edge fades, hide the scrollbar, preserve disabled arrow width, and apply `overflow: hidden` to the frame.

- [ ] **Step 7: Run desktop integration tests.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-desktop.int.spec.tsx
```

Expected: source order, strict `>1170px` boundary, hover intent, keyboard behavior, right-edge initialization, scroll controls, indicator, Escape, outside close, and live-data removal pass.

### Task 4: Implement Mega Menu Surface, Overlay, and Scroll Chaining

**Files:**
- Modify: `src/Header/Nav/DesktopNav.tsx`
- Modify: `src/Header/Nav/DesktopMegaMenu.tsx`
- Modify: `src/Header/Nav/index.module.css`
- Test: `tests/int/header-desktop.int.spec.tsx`
- Test: `tests/e2e/website-shell.e2e.spec.ts`

- [ ] **Step 1: Add DOM and interaction tests.**

Assert one overlay and one scrolling panel exist only while a menu is open. Clicking the overlay closes the menu. Scrolling the page does not close it. Moving between trigger and panel cancels close.

- [ ] **Step 2: Render the overlay below the panel.**

Use a project-owned button or presentation element with an accessible close label:

```tsx
<button
  aria-label="Close navigation menu"
  className={styles.pageOverlay}
  onClick={close}
  type="button"
/>
```

Layer order: page, 7% overlay, Mega Menu, Header controls. The overlay begins below the Header and remains behind the full Mega Menu.

- [ ] **Step 3: Make `.megaMenuInner` the only vertical scroll owner.**

Apply:

```css
max-height: min(70dvh, 42rem);
overflow-y: auto;
overscroll-behavior-y: auto;
scrollbar-width: thin;
```

Remove vertical scrolling from `.categoryPanel`. Do not lock body scroll on desktop. Verify native scroll chaining in both directions; add wheel transfer logic only if browser verification proves native chaining fails.

- [ ] **Step 4: Apply the approved glass and motion values.**

Use `rgb(255 255 255 / 82%)`, `blur(28px) saturate(120%)`, a subtle border/shadow, `220ms` open and `180ms` close transitions. Menu-to-menu content changes keep the panel and overlay mounted while content fades over `160ms`.

- [ ] **Step 5: Run desktop tests and the targeted scroll E2E.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-desktop.int.spec.tsx
corepack pnpm test:e2e -- tests/e2e/website-shell.e2e.spec.ts --grep "Desktop navigation|Mega Menu scroll"
```

Expected: panel remains open while the page scrolls after either vertical boundary, and closes only on approved dismissal events.

### Task 5: Polish Category Tabs and Product Cards

**Files:**
- Modify: `src/Header/Nav/CategoryTabs.tsx`
- Modify: `src/Header/Nav/NavigationCard.tsx`
- Modify: `src/Header/Nav/blocks.module.css`
- Test: `tests/int/header-block-rendering.int.spec.tsx`

- [ ] **Step 1: Add tests for CTA ownership and stable height.**

Verify block CTA is rendered in the Category column and active-category CTA in the product heading row. Assert no arrow glyph is rendered. Simulate multiple category heights and assert the largest measured height remains reserved for the desktop session.

- [ ] **Step 2: Add the `100ms` Category hover-intent timer.**

Pointer entry schedules `select(category.id)` after `100ms`; click selects immediately. Clear the pending timer on unmount and on a new target.

- [ ] **Step 3: Restructure the desktop Category layout.**

Use:

```tsx
<aside className={styles.categorySelectorColumn}>
  <div className={styles.categorySelector} role="tablist">...</div>
  <CategoryCTA className={styles.categoryPrimaryCTA} link={block.cta} />
</aside>
<div className={styles.categoryContent}>
  <div className={styles.blockHeader}>...</div>
  <div className={styles.productCardGrid}>...</div>
</div>
```

The left column is sticky only while the Category block is active. If content cannot fit its visible height, disable sticky via measured/data state rather than adding a nested scroll container.

- [ ] **Step 4: Move active Category CTA into the product header.**

Render it as a compact outline button at the top right. The Category block CTA remains a full-width bottom button in the left column.

- [ ] **Step 5: Apply the product-card internal contract.**

Product variant: complete light-gray card, `4:3` media, contained image capped near 82%, fixed two-line centered title area, no description or icon. Hover only scales the image to `1.035` inside the clipped media area.

- [ ] **Step 6: Remove category-panel nested scrolling and preserve maximum session height.**

Keep the existing largest-observed-height behavior, but remove `overflow-y: auto` and the 36rem panel cap. The outer Mega Menu owns clipping and scrolling.

- [ ] **Step 7: Run block rendering tests.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-block-rendering.int.spec.tsx
```

Expected: 8-card category renders four columns by two rows at desktop width, CTA positions are stable, and category switching does not move following Blocks.

### Task 6: Polish Card Group, Link Group, and Rich Card

**Files:**
- Modify: `src/Header/Nav/NavigationBlocks.tsx`
- Modify: `src/Header/Nav/NavigationCard.tsx`
- Modify: `src/Header/Nav/blocks.module.css`
- Test: `tests/int/header-block-rendering.int.spec.tsx`

- [ ] **Step 1: Add tests for each block variant.**

Assert visual cards have no `ArrowUpRight`, group CTA is inside the heading row, Link Group anchors have no decorative arrow, and Rich Card remains one natural-height block with description clamping.

- [ ] **Step 2: Introduce one reusable block header structure.**

Render heading and CTA together:

```tsx
<div className={styles.blockHeader}>
  {heading ? <h2 className={styles.blockHeading}>{heading}</h2> : <span />}
  <CTA className={styles.blockCTA} link={cta} />
</div>
```

Do not change Block order or data contracts.

- [ ] **Step 3: Apply Card Group rules.**

Desktop uses four columns, `24px` horizontal and `16px` vertical gaps. Mobile uses two columns. Visual cards retain 16:9 cover media, title overlay, bottom-only 35% gradient, `6–8px` radius, and `360ms` image scale. Remove the lower-right icon.

- [ ] **Step 4: Apply Link Group rules.**

Use 12px/700 headings, 13–14px normal links, 32px desktop and 44px mobile minimum targets, tight same-group spacing, and underline-only hover.

- [ ] **Step 5: Apply Rich Card rules.**

Keep one Rich Card Block per card. Use natural height, 16:9 contained media, upper image/lower text, two-line title and three-line description, light-gray background, and no arrow icon.

- [ ] **Step 6: Run block tests.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-block-rendering.int.spec.tsx
```

Expected: all card/link/rich variants match their accessible structure without schema changes.

### Task 7: Replace Mobile Drill-Down with One-Panel Accordion

**Files:**
- Modify: `src/Header/Nav/navigationState.ts`
- Modify: `src/Header/Nav/MobileNav.tsx`
- Modify: `src/Header/Nav/index.module.css`
- Modify: `src/Header/Nav/blocks.module.css`
- Test: `tests/int/header-mobile-navigation.int.spec.tsx`

- [ ] **Step 1: Replace the reducer tests.**

Use a state shape centered on one open top-level item:

```ts
type NavigationState = {
  activeSectionId: string | null
  sectionAccordion: Record<string, string | null>
}
```

Opening another top-level item replaces `activeSectionId` and clears compact Category state. Closing or resetting returns `initialNavigationState`.

- [ ] **Step 2: Remove independent section/back-view rendering.**

Render every top-level row and its collapsible content in the same `mobile-navigation-root` panel. Delete Back controls, section panel refs, per-section scroll maps, and separate section header title.

- [ ] **Step 3: Implement one-open-at-a-time top-level accordions.**

Dropdown and Hybrid rows render a full-width button with one rotating `ChevronRight`. Direct links render an anchor with a fixed right arrow. Switching rows replaces the active id.

- [ ] **Step 4: Add the Hybrid “View all” destination at content bottom.**

For Hybrid items only, append a link labeled `View all ${item.label}` after its Blocks and inherit `href`, `newTab`, `rel`, and `target` from the original top-level link.

- [ ] **Step 5: Keep compact Category accordions closed by default and single-open.**

Pass `expandedCategoryId` from `sectionAccordion[block.id]`. Closing/switching top-level sections clears it. Category content uses natural height and two-column product cards.

- [ ] **Step 6: Use one CSS hamburger button and fixed bottom CTA.**

Replace Lucide Menu/X swapping with three project-owned lines. Animate first/third lines to X and fade the middle line over `300ms`. Keep the existing left-hamburger, centered-logo, right-search geometry. Place `Shop Insta360` in a fixed bottom action bar outside the scrolling accordion area.

- [ ] **Step 7: Preserve modal accessibility and page lock.**

Keep dialog semantics, inert background isolation, focus trap, Escape close, route-change close, strict `>1170px` transition close, body scroll restoration, and focus return to the hamburger.

- [ ] **Step 8: Run mobile tests.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts tests/int/header-mobile-navigation.int.spec.tsx
```

Expected: one-panel accordion, single top-level/Category expansion, View all link, fixed CTA, reset behavior, focus trap, scroll lock, and breakpoint close all pass.

### Task 8: Responsive Browser Verification and Regression

**Files:**
- Modify if necessary: `tests/e2e/website-shell.e2e.spec.ts`
- Artifacts: `/Users/jason/.codex/visualizations/2026/09/15/01a0a545-abe8-72c0-b26a-36b31bea31a7/header-optimization/`

- [ ] **Step 1: Update E2E flows to the approved interaction model.**

Replace three-level mobile Back navigation with same-panel accordion assertions. Add desktop checks for transparent/scrolled/open surfaces, right-edge overflow, indicator movement, overlay click, scroll chaining, and no menu chevrons.

- [ ] **Step 2: Run focused integration tests.**

Run:

```bash
corepack pnpm exec vitest run --config ./vitest.config.mts \
  tests/int/header-component.int.spec.tsx \
  tests/int/header-desktop.int.spec.tsx \
  tests/int/header-mobile-navigation.int.spec.tsx \
  tests/int/header-block-rendering.int.spec.tsx
```

Expected: all focused tests pass.

- [ ] **Step 3: Run static verification.**

Run:

```bash
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
```

Expected: exit code 0. If repository-wide lint reports an unrelated existing issue, run ESLint on changed Header/test files and report both results explicitly.

- [ ] **Step 4: Start the branch with the approved local environment and inspect real content.**

Run `corepack pnpm dev`, keep the server running, and use the existing Header data. Verify at `1440x1000`, `1171x900`, `1170x900`, `768x1024`, and `390x844`.

- [ ] **Step 5: Verify desktop visual and interaction outcomes.**

Check:

```text
top transparent / scroll 90% white / open 90% white
82% glass panel + 7% page overlay
right-priority one-line primary navigation
arrow boundaries and focused-item auto scroll
shared bottom indicator alignment before and after strip scroll
100ms initial open, immediate switch, 200ms delayed close
single vertical Mega Menu scroller and bidirectional page chaining
8 product cards in 4 x 2 rows
sticky Category, fixed left CTA, active-category right CTA
all images loaded and no horizontal overflow
```

- [ ] **Step 6: Verify mobile visual and interaction outcomes.**

Check:

```text
transparent top / 100% white scrolled and open
same hamburger morph, centered logo, fixed search
one top-level accordion open at a time
one Category open at a time, closed by default
Hybrid View all at expanded-content bottom
two-column product cards
fixed bottom Shop Insta360 action area
body lock, Escape, route reset, focus return
```

- [ ] **Step 7: Capture screenshots and keep artifacts outside the repository.**

Save desktop Products open, desktop scrolled, desktop overflow, mobile root, and mobile Products/Category open screenshots to the visualization directory above. Move `.playwright-cli/` and `output/` artifacts out of the repository before completion.

- [ ] **Step 8: Run the targeted E2E suite.**

Run:

```bash
corepack pnpm test:e2e -- tests/e2e/website-shell.e2e.spec.ts
```

Expected: Header shell flows pass. Separate MongoDB/environment failures from application regressions.

- [ ] **Step 9: Review the final diff.**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; no `.env`, generated Payload files, Playwright artifacts, lockfile changes, or unrelated files added by this work.
