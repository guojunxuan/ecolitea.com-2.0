# Website Shell Responsive Design

**Date:** 2026-09-06

## Objective

Replace the inherited Payload Website Template frontend shell with a responsive Ecolitea website framework. The new shell includes the global layout system, Header, desktop Mega Menu, shared Tablet/Mobile full-screen navigation, Footer, and a disabled newsletter placeholder.

The former Ecolitea project at `/Users/jason/ecolitea.com` is a visual and interaction reference only. Implementation remains native to the current Next.js 16, Payload 4, React 19, and Tailwind 4 repository and follows its existing module boundaries.

## Scope

### Included

- Remove the frontend `AdminBar` from the Website layout without changing Payload Admin.
- Introduce shared responsive layout tokens and container primitives.
- Adapt the existing Header Global to a stable frontend navigation view model.
- Build a fixed desktop Header with a full-width Mega Menu.
- Build one shared full-screen, three-level sliding navigation for Tablet and Mobile.
- Adapt the existing Footer and Site Settings Globals to a responsive Footer.
- Add a visually complete but disabled newsletter placeholder.
- Preserve Draft Mode and Live Preview independently of the removed Admin Bar.
- Add responsive, interaction, accessibility, and data-adaptation tests.

### Excluded

- Changes to the Header, Footer, Site Settings, or Social Platforms Payload schemas.
- Copying the former project's SCSS architecture, grid utilities, aliases, or component tree.
- A functional newsletter subscription API, persistence, consent flow, or third-party integration.
- A new Top Bar Global or frontend Top Bar.
- Redesigning page-specific Heroes, Blocks, Posts, or Case Studies beyond adopting the new shell contracts.
- Editing or staging the existing unrelated Social Platform worktree changes.

## Design Principles

1. Preserve the former site's recognizable proportions, technical grid character, restrained palette, and typography while simplifying its implementation.
2. Treat the current repository as the only code architecture. Old code informs behavior but is not copied.
3. Keep server data loading, data adaptation, client interaction, and presentation separate.
4. Share one responsive breakpoint model across Header, content, and Footer.
5. Keep Tablet and Mobile structurally identical where agreed; vary only dimensions and spacing.
6. Consume every valid state the current Payload Globals can store, including maximum row counts and inactive conditional data.
7. Prefer accessible native semantics and progressive enhancement over visually convenient but fragile interactions.

## Global Website Shell

The frontend Root Layout remains a Server Component and composes the existing providers, Header, page content, and Footer. It no longer mounts `AdminBar`.

```text
Root Layout
├── Providers
├── Header
├── Main content
└── Footer
```

The body remains a vertical flex container with a minimum viewport height so the Footer reaches the bottom of short pages. The fixed Header establishes a shared top-offset variable for the main content. A global client wrapper around the entire site is not introduced.

Draft Mode and page-level `LivePreviewListener` behavior remain available. Removing the Admin Bar removes only the visible frontend editing toolbar.

## Responsive Model

The site uses four layout ranges with one structural navigation handoff:

| Range | Width | Structure |
| --- | --- | --- |
| Mobile | below 768px | single-column content; full-screen navigation; accordion Footer |
| Tablet | 768px–1169px | wider content grid; same full-screen navigation and Footer structure as Mobile |
| Desktop | 1170px–1439px | desktop Header, Mega Menu, and three-zone Footer |
| Wide | 1440px and above | desktop structure with increased outer whitespace |

The `1170px` handoff is shared by Header and Footer. Components must not invent nearby breakpoint values that create mismatched modes.

## Container and Spacing System

The former site's 1220px content width remains the visual baseline, implemented through current Tailwind 4 and CSS-variable conventions rather than copied SCSS utilities.

Four semantic widths are available:

- `viewport`: full-bleed backgrounds and visual treatments.
- `site`: Header, Footer, ordinary page sections, and Mega Menu content; approximately 1220px maximum.
- `wide`: selected media and Hero treatments that intentionally exceed the ordinary site container.
- `reading`: long-form text, approximately 720–760px maximum.

Horizontal gutters scale from approximately 16px on Mobile to 32px on Tablet and 40–48px on Desktop. They use a small set of CSS variables and `clamp()` where useful instead of the former project's nine-breakpoint gutter cascade.

Vertical rhythm uses semantic `compact`, `standard`, and `spacious` section spacing. Existing page components and Blocks migrate incrementally away from unrelated local values such as repeated `my-16`; this shell task establishes the contract and updates only the components needed for a coherent initial shell.

## Header Architecture

The current module boundary remains authoritative:

```text
src/Header/
├── Component.tsx
├── Component.client.tsx
├── Nav/
│   ├── desktop presentation
│   ├── Mega Menu presentation
│   └── Tablet/Mobile presentation
├── navigation/
│   ├── Payload-to-view-model adapter
│   ├── href resolver
│   ├── mobile navigation reducer
│   └── frontend navigation types
└── existing config, fields, hooks, and validators
```

Exact component file granularity may be consolidated when a file remains focused. Frontend behavior does not move into Payload field configuration or validation modules.

`Component.tsx` fetches Header and Site Settings concurrently, resolves brand assets, and adapts the raw Header document before passing it across the client boundary. Presentation components consume a stable frontend view model rather than interpreting Payload conditional branches independently.

## Header Data Adaptation

The adapter reads only the active discriminator branch and ignores preserved inactive Admin values.

| Payload shape | Frontend meaning |
| --- | --- |
| `directLink` | top-level direct destination |
| `dropdown` | top-level menu trigger |
| `directLinkAndDropdown` | hybrid destination and menu trigger |
| `dropdown.description` | menu introduction |
| `descriptionLinks` | supporting menu links |
| `defaultItem` | direct item within level two |
| `featuredItem` | emphasized branch with optional rich content and a third level |
| `listItem` | labeled branch with a third-level link list |
| `landingLink` | branch overview destination |
| `menuCta` | primary Header action when enabled |

Top-level unlabeled links use the Navigation Item `label`. Featured and List landing links use their `tag`. Optional Featured `label` content remains Lexical Rich Text and renders through the existing Rich Text system with Header-specific styling.

The href resolver supports all Header-configured internal relationship targets: Pages, Posts, Case Studies, and Categories. It replaces the current frontend assumption that CMS links target only Pages or Posts. Invalid or unresolved individual destinations are omitted without failing the entire Header.

The optional CTA is emitted only when `enableMenuCta` is true and its destination resolves.

## Desktop Header and Mega Menu

At 1170px and above, the Header is fixed and approximately 88–90px tall. Its content aligns with the shared `site` container:

```text
Logo | Navigation | Search + optional CTA
```

The Header may be transparent over an eligible first section. Scrolling beyond a small threshold or opening a menu gives it an opaque surface and divider. Page authors do not manually calculate Header offsets.

Direct links navigate immediately. Dropdown-only items open their Mega Menu. For `directLinkAndDropdown`, the text activates the direct destination and a separate, labeled chevron button opens the menu. Pointer hover may enhance desktop behavior, but click and keyboard interaction remain complete.

The Mega Menu uses a full-viewport background while its content aligns to the 1220px `site` container. Description content, Description Links, Default items, Featured items, and List items use a restrained editorial grid rather than a collection of generic cards.

The Header Global permits up to eight top-level items. The frontend must consume all valid items. When available width cannot fit every item beside the Logo, search, and CTA, trailing items move into an accessible `More` menu rather than overflowing or disappearing.

Only one Mega Menu is open at a time. It closes on outside activation, Escape, route changes, focus leaving the interaction boundary when appropriate, or transition to the non-desktop breakpoint.

## Tablet and Mobile Full-Screen Navigation

Below 1170px, Tablet and Mobile use the same full-screen navigation structure and interaction. Tablet uses an approximately 64px Header and 32px horizontal gutter; Mobile uses an approximately 60px Header and 16px gutter.

Opening the menu covers the viewport, locks background scrolling, and keeps the Logo and close action visible. The navigation viewport contains three horizontally animated panels:

```text
Level 1: Navigation Items
Level 2: selected Dropdown
Level 3: selected Featured or List branch
```

A pure reducer or equivalent explicit state machine stores the active level, top-level item, and branch. It does not infer navigation state from DOM position.

- A Direct Link activates from level one.
- A Dropdown enters level two.
- A Direct Link + Dropdown enters level two and exposes its direct destination as `Overview` near the top.
- A Default item activates directly from level two.
- A Featured or List item enters level three.
- A Featured/List Landing Link appears at the top of level three as `View all` or an equivalent context-specific label.
- Back performs the inverse horizontal transition and returns focus to the originating row.

Each panel owns its scrolling region. Rows provide at least a 48px touch target. The menu resets to level one when closed, after navigation, or when crossing to Desktop. Escape closes the overlay, focus is contained while open and restored on close, and `prefers-reduced-motion` removes nonessential sliding motion.

## Footer Architecture and Data

The Footer remains server-rendered. It fetches Footer and Site Settings concurrently and builds a presentation model from:

- Site name, Logo, dark-background Logo, and site description.
- Social links and their related Social Platform definitions.
- Sales email, phone, WhatsApp, address, and business hours.
- Footer navigation columns.
- Copyright text and configured Privacy/Terms pages.

A small client boundary owns only the non-desktop navigation accordion. Data loading and the full Footer do not become client-rendered.

Missing optional data removes only its own row. Missing Logo data falls back to the Site Name. A missing dark-background Logo falls back to the primary Logo. Empty navigation columns and unresolved links are omitted. An invalid social relationship or URL does not break the Footer.

## Desktop Footer

At 1170px and above, the Footer is a near-black full-width surface whose content aligns to the shared 1220px container. It uses three flexible zones visually equivalent to the former site's 20/55/25 relationship:

```text
Brand and social | up to four navigation columns | newsletter placeholder and contact
```

The lower utility row contains copyright information and configured legal links. The layout remains stable with fewer than four navigation columns and with optional contact fields absent.

## Shared Tablet and Mobile Footer

Below 1170px, Tablet and Mobile use the same single-column DOM order and accordion behavior:

```text
Brand
Description
Social links
Navigation accordion
Newsletter placeholder
Contact details
Legal links
Copyright
```

Tablet does not use a two-by-two navigation grid. It differs from Mobile only through gutter, maximum readable width, and spacing.

Navigation uses a single-open accordion with trigger rows at least 54px tall. Its server-rendered baseline keeps links accessible when client enhancement is unavailable. Long labels, URLs, and addresses wrap without causing horizontal scrolling. Social controls provide at least a 44px touch area.

## Newsletter Placeholder

The first phase includes a visually complete but nonfunctional subscription area. It contains a module-owned heading, short description, email placeholder, and Subscribe button. These values are frontend constants because the current Globals contain no Newsletter fields.

The input and button are disabled and excluded from meaningless keyboard interaction. The placeholder performs no request, stores no address, creates no consent state, and displays no false success or error feedback. Its module boundary permits a later CMS or provider integration without distributing placeholder copy through Footer JSX.

## Visual Direction

The shell uses the former site's engineering character without reproducing its implementation:

- refined grotesk typography based on the existing Ecolitea Untitled Sans direction;
- near-black, warm white, graphite, and restrained ecological green;
- strict alignment, fine dividers, sparse shadows, and limited corner rounding;
- strong type hierarchy and generous negative space;
- no gradients, glassmorphism, decorative dashboard cards, or pill-heavy controls.

Final implementation uses the configured Site Settings SVG assets and Social Platform icons. Concept-image substitute marks are not production assets.

## Accessibility and Interaction Safety

- Header, primary navigation, Footer navigation, and legal navigation use distinct semantic labels.
- Menu buttons expose `aria-expanded` and `aria-controls`.
- Full-screen navigation behaves as a modal surface with intentional focus entry, containment, and restoration.
- Mega Menu and overflow actions remain usable by keyboard without pointer hover.
- Escape closes the active overlay or menu.
- Visible focus treatments meet contrast requirements on light and dark surfaces.
- Touch targets meet the defined minimum sizes.
- Reduced-motion preference removes sliding and other nonessential transitions.
- Body scroll locking restores the previous state on every close and unmount path.

## Error Handling

The frontend adapter treats Payload validation as the primary data guarantee but remains defensive at the rendering boundary:

- unknown discriminators are omitted;
- incomplete active items are omitted at the smallest possible scope;
- unresolved references do not produce empty anchors;
- missing optional content collapses cleanly;
- one malformed navigation or contact item does not prevent the remaining shell from rendering.

Development diagnostics may identify rejected items without exposing CMS internals to visitors.

## Testing

### Pure unit coverage

- Header discriminator-to-view-model mapping.
- Ignoring inactive conditional branches.
- Display-label synthesis for top-level and landing links.
- href resolution for Pages, Posts, Case Studies, Categories, and Custom URLs.
- optional CTA behavior.
- Mobile navigation reducer transitions and reset behavior.
- Footer data adaptation and optional-field omission.
- accordion single-open behavior.

### Component coverage

- Desktop direct, dropdown, and hybrid interactions.
- Mega Menu open/close and keyboard behavior.
- overflow collection into `More` without losing items.
- three-level non-desktop navigation, reverse transitions, and focus restoration.
- Footer Desktop structure and shared Tablet/Mobile accordion structure.
- disabled Newsletter controls.
- missing Logo and partial contact fallbacks.

### End-to-end coverage

- Desktop, Tablet, and Mobile breakpoint handoffs.
- fixed Header and main-content offset.
- route changes close and reset navigation.
- background scroll locking and restoration.
- Escape and outside-close behavior.
- no horizontal overflow at representative viewports.
- Header and Footer consume the current Global shapes without runtime errors.

Visual verification uses representative Mobile, Tablet, Desktop, and Wide viewports and confirms that Tablet and Mobile share the same Footer structure.

## Success Criteria

The public website has one coherent responsive shell; no frontend Admin Bar or unsupported Top Bar appears; Header, content, and Footer share the same container and breakpoint language; Desktop provides a robust Header and Mega Menu; Tablet and Mobile provide one accessible full-screen three-level navigation; all valid current Header data shapes have an explicit frontend representation; Footer consumes current Footer and Site Settings data; Tablet and Mobile share a single-column accordion Footer; the newsletter area is visibly disabled and performs no data operation; configured brand assets and social icons replace concept placeholders; and the implementation follows the current repository's architecture without importing the former project's structural debt.
