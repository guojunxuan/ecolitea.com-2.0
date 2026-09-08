# Header Navigation Blocks Design

**Date:** 2026-09-08

## Objective

Upgrade the existing Header Global from a radio field with three conditional item groups to a constrained, Payload-native Blocks model. The redesign must support straightforward links, categorized and uncategorized link lists, and image-led featured content without turning the Header into an unrestricted page builder.

The same stored navigation content drives the desktop Mega Menu and the existing shared Tablet/Mobile full-screen sliding navigation. Payload owns content and relationships; the frontend owns responsive layout and interaction.

## Scope

### Included

- Preserve the top-level `navItems` Array and the three existing navigation behaviors: `directLink`, `dropdown`, and `directLinkAndDropdown`.
- Add an explicit dropdown presentation preference: `auto`, `compact`, or `mega`.
- Replace newly authored `dropdown.items` content with a `dropdown.content` Blocks field.
- Provide three constrained block types: `simpleLink`, `linkList`, and `featuredCard`.
- Let a Link List work either as a flat list or a categorized group through an `enableHeading` switch.
- Let each Link List optionally end with its own labeled CTA.
- Preserve the existing introduction content and supporting links.
- Add image-led Featured Cards backed by the existing `media` Upload collection.
- Adapt the new Payload document to stable frontend render data in one Header adapter.
- Support pointer, keyboard, touch, responsive, reduced-motion, and focus-management behavior.
- Keep existing Header records rendering during a staged content transition.
- Add focused schema, validation, adapter, rendering, interaction, and responsive browser tests.

### Excluded

- Ecommerce-only account, cart, price, discount, inventory, or merchandising fields.
- A generic page-builder or Admin-controlled grid, column count, card position, width, or mobile order.
- Search implementation changes, Header branding changes, Footer changes, or page-content changes.
- A new media collection or a new third-party dependency.
- Immediate deletion of legacy `dropdown.items` data.
- A production data rewrite that invents missing images for legacy Featured items.

## Design Principles

1. Use Payload's native `Array`, `Blocks`, `Group`, `Upload`, and reusable Link fields as the stored content model.
2. Constrain author choices to patterns the frontend can render consistently across all breakpoints.
3. Keep Payload vocabulary at the backend/frontend boundary; do not create a parallel CMS dialect.
4. Separate schema configuration, validation, normalization, data adaptation, interaction state, and presentation.
5. Preserve valid existing content during schema evolution instead of silently dropping fields or synthesizing media.
6. Keep responsive placement deterministic in frontend code. Admin users choose content meaning, not CSS layout.
7. Reuse the current repository owners under `src/Header/`; do not add a second navigation framework.

## Content Model

The top-level Header shape remains recognizable:

```text
Header Global
├── navItems                         Array, 0–8
│   ├── label *                      Text
│   ├── navigationType *             Radio
│   │   ├── directLink
│   │   ├── dropdown
│   │   └── directLinkAndDropdown
│   ├── link                         Group, conditional
│   └── dropdown                     Group, conditional
│       ├── menuStyle *              Select: auto | compact | mega
│       ├── introduction             Group
│       │   ├── heading              Text
│       │   ├── description          Textarea
│       │   └── links                Array of labeled Link fields, 0–3
│       ├── content *                Blocks, 1–12
│       │   ├── Simple Link
│       │   ├── Link List
│       │   └── Featured Card
│       └── items                    Legacy Array, transition only
├── enableMenuCta                    Checkbox
└── menuCta                          Group, conditional
```

`link` is required for `directLink` and `directLinkAndDropdown`. `dropdown` is required for `dropdown` and `directLinkAndDropdown`. A `directLinkAndDropdown` item continues to expose a direct overview destination and a separate dropdown control.

### Introduction

`introduction` owns optional explanatory content for the whole dropdown. Its `heading` is optional because the top-level Navigation Item label already supplies context. Existing `dropdown.description` and `descriptionLinks` map directly into the new group during a later content migration; until then the adapter can read their legacy locations.

Introduction links are supporting destinations, not a dropdown-wide footer. The top-level Direct Link remains the canonical overview destination when `navigationType` is `directLinkAndDropdown`.

### Simple Link Block

```text
Simple Link
├── link *                           Labeled Link group
└── description                     Textarea
```

A Simple Link is a direct level-two destination. It has no Heading concept and creates no third navigation level. The optional description appears in desktop Compact and Mega presentations and is omitted from Tablet/Mobile rows.

### Link List Block

```text
Link List
├── enableHeading                   Checkbox, default false
├── heading *                       Text, conditional
├── links *                         Array of labeled Link fields, 1–8
├── enableCta                       Checkbox, default false
└── cta *                           Labeled Link group, conditional
```

`heading` is required only when `enableHeading` is true. In Admin, the switch and conditional Heading stay together before the Links Array so editors establish the list's meaning before adding entries.

When `enableHeading` is false, the block preserves the original flat-list capability: its links are exposed directly at the current navigation level with no artificial category label. When enabled, the Heading introduces a categorized group. On Tablet/Mobile, that categorized group becomes a drill-down row leading to its links.

`cta` is required only when `enableCta` is true. It is rendered after the list links. Its label is authored in Payload and is never replaced in the adapter with a hardcoded `View all` string.

### Featured Card Block

```text
Featured Card
├── image *                         Upload relationship to media
├── eyebrow                        Text
├── heading *                       Text
├── description                    Textarea
└── link *                          Link group
```

A Featured Card highlights a product, solution, customer story, report, event, or other editorial destination. It is not a commerce product card. The image and destination are required for newly authored cards so the block has a predictable contract and accessible linked-card presentation.

The card itself navigates directly; it does not create a hidden collection of child links. Related destinations belong in an adjacent Link List.

## Dropdown Presentation

`menuStyle` expresses intent without exposing layout mechanics:

- `auto` is the default. The frontend selects Compact when content contains no Featured Card and fits the compact density rules; otherwise it selects Mega.
- `compact` requests the narrower desktop menu treatment. When the content violates any Compact density condition defined below, the frontend promotes it to Mega rather than truncating or overflowing.
- `mega` requests the full-width desktop Mega Menu even for a small content set.

The exact grid, column count, widths, alignment, and responsive order are frontend-owned. They are not stored in Payload.

For deterministic `auto` behavior, Compact is used only when all of these conditions hold:

- no Featured Card is present;
- there are no more than six rendered destinations across Simple Links, Link List links, and Link List CTAs;
- there is no more than one headed Link List.

All other valid content uses Mega. These rules live in a pure adapter/presentation helper and are covered by unit tests.

## Desktop Behavior

At the existing 1170px structural breakpoint and above, direct links navigate immediately. Dropdown triggers support complete click and keyboard interaction. On fine-pointer devices, pointer entry opens the associated dropdown after 120ms and pointer exit schedules closure after 180ms. Entering the trigger or panel before the close timer expires cancels closure, permitting movement between them without flicker.

For `directLinkAndDropdown`, the label remains the direct link and a separate chevron button controls the dropdown. The chevron is rendered from `navigationType` and dropdown availability, not from a hardcoded list of menu names.

Only one dropdown is open at a time. It closes on Escape, outside activation, route change, transition below the desktop breakpoint, or focus leaving the complete Header interaction boundary while the pointer is not inside that boundary. Focus and `aria-expanded` state remain synchronized with the active menu.

Compact and Mega are two presentations of the same adapted blocks:

- Simple Links render as direct rows or concise text items.
- Unheaded Link Lists render as flat destinations.
- Headed Link Lists render as labeled groups with an optional CTA at the end.
- Featured Cards render as image-led editorial cards.
- Introduction content occupies a stable introductory region when present.

The existing overflow behavior remains: up to eight valid top-level Navigation Items are consumed, and trailing items move into an accessible `More` menu when available width is insufficient.

## Tablet and Mobile Behavior

Below 1170px, Tablet and Mobile continue to share the existing full-screen, multi-level sliding navigation. They use the same adapted data and reducer; only spacing and dimensions differ.

```text
Level 1: top-level Navigation Items
Level 2: Introduction, Simple Links, flat Link List links,
         headed Link List rows, Featured Cards, and overview link
Level 3: links and optional CTA from the selected headed Link List
```

- A `directLink` activates from level one.
- A `dropdown` enters level two.
- A `directLinkAndDropdown` enters level two and shows its direct destination as an Overview row.
- A Simple Link and Featured Card navigate directly from level two.
- An unheaded Link List exposes its links directly on level two.
- A headed Link List opens level three; its CTA follows the links at the end.

Opening the menu locks background scrolling and traps focus. Back returns to the previous panel and restores focus to the originating row. Closing resets to level one and restores focus to the menu button. Escape, route changes, and breakpoint changes close the overlay. `prefers-reduced-motion` disables nonessential sliding animation.

## Admin Experience

Blocks use clear labels and row labels based on their meaningful content:

- Simple Link: link label;
- Link List: Heading when enabled, otherwise `Link List · N links`;
- Featured Card: Heading.

The Blocks chooser exposes only the three approved content types. Fields use descriptions to distinguish content intent from frontend presentation. Conditional required markers and server validation must agree.

Legacy `items` remain visible only in a collapsed, clearly marked read-only transition area when legacy rows exist. Editors create all new content in `content`. A dropdown is valid when it has at least one new Content block or at least one legacy Item during the transition; newly created dropdowns must use Content.

## Validation and Normalization

Header-owned text is trimmed before validation and persistence. Required text must remain nonblank after trimming.

Validation enforces:

- at most eight top-level Navigation Items;
- one to twelve Content blocks for newly authored dropdowns;
- one to eight links per Link List;
- no more than three Introduction links;
- Heading presence exactly when `enableHeading` is true;
- CTA completeness exactly when `enableCta` is true;
- required media and link destination for every Featured Card;
- active Direct Link and Dropdown branches required by `navigationType`;
- valid internal relationships or valid HTTP(S), mail, telephone, or repository-supported custom URLs;
- unique top-level labels after trimming;
- duplicate active destinations rejected within the same dropdown, including Introduction links, block links, and CTAs.

Inactive conditional values are ignored for rendering. Normalization clears `heading` when `enableHeading` is false and clears `cta` when `enableCta` is false so stale hidden values cannot reappear unexpectedly.

## Data Adaptation and Module Boundaries

The current server boundary remains:

```text
getCachedHeader()
      ↓
adaptHeaderNavigation(raw Header)
      ↓
HeaderNavigationData
      ├── DesktopNav / DesktopMegaMenu
      └── MobileNav
```

`Component.tsx` remains responsible for fetching cached Globals and resolving branding. `adaptNavigation.ts` remains the single owner of Payload-to-render-data conversion. Desktop and mobile components consume a discriminated render union and do not inspect Payload conditional branches themselves.

The frontend render union mirrors the Blocks contract:

```text
HeaderDropdownContent
├── { blockType: 'simpleLink', ... }
├── { blockType: 'linkList', enableHeading, heading, links, cta }
└── { blockType: 'featuredCard', image, eyebrow, heading, description, link }
```

Invalid individual blocks or unresolved destinations are omitted without crashing the Header. If no valid content remains, the adapter does not expose an empty dropdown trigger. Media resolution uses the existing media presentation utilities and must not assume a local filesystem URL.

No new global cache layer is introduced. Existing canonical Header reads, revalidation hooks, and request depth remain the owners of fetching and cache invalidation.

## Legacy Compatibility and Migration

The first implementation is deliberately additive:

1. Add `dropdown.content`, `menuStyle`, and the Introduction group.
2. Retain legacy `description`, `descriptionLinks`, and `items` fields in a transition-only Admin area.
3. Prefer valid new Content blocks in the adapter.
4. When Content is empty, adapt the legacy structure exactly as the current frontend does.
5. Preserve the currently visible legacy `View all` label only in the legacy adapter path; new Link List CTAs always use their stored CMS label.
6. Let editors recreate each dropdown in the new Blocks model while the public Header continues to render.
7. Remove legacy schema fields and fallback code only in a separately approved cleanup after all environments contain migrated Content.

This strategy avoids fabricating a required image for legacy Featured items, avoids dropping their Rich Text or child links, and makes rollback possible during the transition. It also keeps migration concerns out of the new permanent block contract.

## Error Handling and Empty States

- A malformed block is omitted rather than throwing during public rendering.
- A missing Featured Card image causes that block to be omitted; alt text follows the existing Media contract and falls back to the card Heading only when the shared image component permits it.
- A dropdown with no valid new or legacy content is omitted as a dropdown. A valid direct destination on `directLinkAndDropdown` remains usable as a direct link.
- Admin validation messages identify the Navigation Item, block type, block position, and failing nested field.
- Client interaction state resets safely if live data or route state removes the active item.

## Accessibility

- Use semantic links for destinations and buttons only for disclosure controls.
- Preserve separate text-link and chevron-button semantics for `directLinkAndDropdown`.
- Expose `aria-expanded`, `aria-controls`, and clear accessible labels on disclosure buttons.
- Maintain visible focus styles and logical DOM order independent of desktop grid placement.
- Ensure keyboard users can open, traverse, and close every menu without relying on hover.
- Make linked Featured Cards expose one unambiguous accessible destination rather than nested interactive elements.
- Keep mobile touch targets at least 44px and navigation rows at least 48px tall.
- Announce panel headings through semantic headings and restore focus after Back or Close.
- Respect reduced-motion preferences.

## Testing Strategy

### Schema and validation tests

- Assert exact block slugs, field names, conditional Admin behavior, row limits, Upload relationship, and interface names.
- Cover flat and headed Link Lists, conditional Heading and CTA requirements, invalid destinations, duplicate destinations, Content bounds, and legacy transition validity.
- Cover normalization of active and inactive block fields.

### Adapter tests

- Adapt each block type and Introduction data independently.
- Verify stored CTA labels are preserved.
- Verify `auto`, `compact`, and `mega` resolution.
- Verify invalid blocks are omitted without affecting valid siblings.
- Verify new Content takes precedence and legacy fallback remains exact when Content is empty.
- Verify media relationships work at supported populated-depth states.

### Component and interaction tests

- Render Compact and Mega menus from the same render union.
- Verify arrows derive from navigation data.
- Cover click, keyboard, fine-pointer intent, focus exit, outside activation, Escape, route change, and breakpoint change.
- Cover flat Link Lists at mobile level two and headed Link Lists at level three.
- Cover Back/Close focus restoration, focus trapping, body scroll lock, and reduced motion.
- Preserve top-level overflow into `More`.

### Browser verification

- Verify 390px, 768px, 1170px, and 1440px viewports.
- Confirm no horizontal overflow, clipped menus, inaccessible links, or layout jumps.
- Confirm Tablet and Mobile use the same full-screen navigation structure.
- Confirm image loading and card fallback behavior against configured media storage.
- Confirm the current legacy Header still renders before any content is recreated in Blocks.

## Delivery Boundary

This design is one implementation project because the schema, adapter, and responsive consumers form one versioned interface. Work proceeds in dependency order: schema and validation, generated types, adapter compatibility, desktop presentation, Tablet/Mobile presentation, then browser verification.

Deleting legacy fields is not part of this delivery. It requires a separate audit proving every deployed Header record has valid `content` blocks.

## Success Criteria

- Admin editors can compose all approved Header patterns using only three constrained Payload Blocks.
- Link List supports both the original uncategorized list and an optional categorized Heading.
- Link List CTA is optional, appears at the end, and uses its stored label.
- Featured Cards support reusable image-led B2B navigation content through the existing Media collection.
- Desktop renders appropriate Compact or Mega treatments without CMS layout controls.
- Tablet and Mobile preserve the full-screen multi-level sliding interaction.
- Direct links, dropdown arrows, levels, and CTAs are entirely data-driven.
- Existing Header content continues to render during the transition.
- The solution adds no dependency and follows the current `src/Header/` architecture.
