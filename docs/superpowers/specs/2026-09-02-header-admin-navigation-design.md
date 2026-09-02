# Header Admin Navigation Design

**Date:** 2026-09-02

## Objective

Upgrade the Payload `header` Global from a simple list of links into a reusable enterprise navigation model. This scope covers only the Admin-managed Header data model and editor experience. It does not change the frontend Header renderer.

The design must follow the current project's Payload conventions, prefer native configuration over custom UI, reuse shared field factories, and remain maintainable across Payload upgrades.

## Scope

### Included

- Keep the Global slug and Admin label as `header` / `Header`.
- Manage up to eight sortable top-level navigation items.
- Let each top-level item behave as a direct link, a dropdown trigger, or both.
- Support mixed `default`, `featured`, and `list` items inside each dropdown.
- Retain the global menu CTA.
- Support internal references and custom URLs everywhere links are used.
- Allow Header references to Pages, Posts, Case Studies, and Categories.
- Provide native Payload validation and concise row labels.
- Preserve the existing Header cache revalidation hook.

### Excluded

- Frontend Header layout, styling, responsive behavior, or rendering.
- Footer changes.
- Logo, branding, contact, legal, or social settings; those remain in Site Settings.
- Announcement bars, locale switching, search UI, account UI, or commerce controls.
- Arbitrarily deep recursive navigation.
- Payload Admin replacement views or custom field editors.

## Implementation Workspace

Implementation will be performed directly in the current checkout and current branch, `main`. Do not create a separate feature branch or Git worktree for this change. Existing unrelated working-tree files and changes must remain untouched.

## Source Models

The design combines three established patterns:

1. Payload's official Website and Ecommerce templates: a Header Global containing a `navItems` Array whose rows reuse a shared `link()` field factory.
2. The former Ecolitea project's richer Main Menu model: dropdown descriptions, supporting links, a menu CTA, and mixed `default`, `featured`, and `list` dropdown items.
3. Common WordPress and Shopify navigation behavior: a top-level item can be a link, a submenu trigger, or a link with children, while navigation content remains independent of a particular frontend theme.

## Business Model

```text
Header
├── Navigation Items (0–8, sortable)
│   └── Navigation Item
│       ├── Label
│       ├── Navigation Type
│       │   ├── Direct Link
│       │   ├── Dropdown
│       │   └── Direct Link + Dropdown
│       ├── Direct Link (conditional)
│       └── Dropdown (conditional)
│           ├── Description
│           ├── Description Links
│           └── Dropdown Items (at least 1, sortable)
│               ├── Default
│               ├── Featured
│               └── List
└── Menu CTA
```

Dropdown item types may be freely mixed within one dropdown.

## Payload Field Structure

### Header Global

- `slug`: `header`
- `access.read`: public
- `access.update`: reuse the project's authenticated access function
- `versions`: `false`
- `hooks.afterChange`: retain `revalidateHeader`

The Global config remains a thin assembly point rather than containing all nested field definitions inline.

### Navigation Items

`navItems` remains the top-level Payload Array to preserve the official template vocabulary and API path.

- `type`: `array`
- `maxRows`: `8`
- sortable using Payload's native Array behavior
- `admin.initCollapsed`: `true`
- `admin.components.RowLabel`: a thin summary component
- `interfaceName`: `HeaderNavItem`

Each row contains:

- `label`: required text
- `navigationType`: required select
  - `directLink`
  - `dropdown`
  - `directLinkAndDropdown`
- Direct Link fields, conditionally shown for `directLink` and `directLinkAndDropdown`
- Dropdown fields, conditionally shown for `dropdown` and `directLinkAndDropdown`

A select is preferred over two checkboxes because it prevents an item with neither behavior enabled and exposes one explicit state to every API consumer.

### Direct Link

The Direct Link reuses `link()` with:

- appearances disabled
- the nested link label disabled because the navigation item already has `label`
- Header-specific internal reference targets

### Dropdown

The Dropdown is organized with native Payload presentational fields. Its data contains:

- `description`: optional textarea
- `descriptionLinks`: optional Array of labeled shared links
- `items`: required Array with at least one row
  - sortable
  - initially collapsed
  - `interfaceName`: `HeaderDropdownItem`
  - a thin RowLabel component

The presentational wrapper must not introduce an unnecessary stored object solely for Admin layout.

### Dropdown Item Types

Every dropdown row has a required `type` select:

- `default`
- `featured`
- `list`

Payload `admin.condition` shows only the matching configuration group.

#### Default

- labeled shared link
- optional description

This represents an ordinary navigational destination.

#### Featured

- required tag
- required landing link, with its nested label disabled
- rich text label/content retained from the former project
- optional Array of labeled related links

This represents a promoted solution, category, campaign, or other emphasized destination.

#### List

- required tag
- required landing link, with its nested label disabled
- optional Array of labeled links

This represents a named group of related destinations.

### Menu CTA

`menuCta` remains outside `navItems` and reuses a labeled `link()` with appearances disabled. Keeping it separate preserves its single global business role and avoids treating the primary action as an ordinary navigation item.

## Shared Link Field Factory

All Header links reuse the current `link()` field factory. The factory already supports:

- internal references
- custom URLs
- labels
- opening in a new tab
- optional appearances
- optional labels
- config overrides

Extend the factory with an optional `relationTo` parameter using Payload's official Relationship Field vocabulary.

- Existing calls retain their current default targets: Pages and Posts.
- Header calls explicitly allow Pages, Posts, Case Studies, and Categories.
- Custom URL remains available for every Header link.

This prevents Header requirements from silently widening relationship choices in Footer or page fields.

## Validation Rules

Validation must run in both the Admin Panel and server-side APIs.

1. `directLink` requires a valid Direct Link.
2. `dropdown` requires at least one Dropdown Item and does not require a Direct Link.
3. `directLinkAndDropdown` requires both a valid Direct Link and at least one Dropdown Item.
4. `default` validates only its active link and description fields.
5. `featured` requires a non-empty tag and a valid landing link.
6. `list` requires a non-empty tag and a valid landing link.
7. Inactive conditional groups must not cause validation failures.
8. Validation errors identify the top-level item and nested group when possible.

Built-in Payload options such as `required`, `minRows`, and `maxRows` handle local constraints. A focused Header validator handles only cross-field business rules.

## Admin Editing Experience

- Use Payload's native Array, Select, Group, Row, Collapsible, condition, labels, descriptions, sorting, and validation UI.
- Keep nested rows initially collapsed to make large menus scannable.
- The top-level RowLabel shows the row number, navigation label, and navigation type.
- The dropdown RowLabel shows the row number, item type, and best available business label or tag.
- RowLabel components read generated Payload types and contain no validation or data mutation logic.
- No custom field editor or custom Global view is introduced.

## Module Boundaries

```text
src/Header/
├── config.ts
├── fields/
│   ├── navigationItems.ts
│   ├── dropdown.ts
│   └── dropdownItems.ts
├── validators/
│   └── validateNavigation.ts
├── RowLabel.tsx
├── DropdownItemRowLabel.tsx
└── hooks/
    └── revalidateHeader.ts
```

- `config.ts`: assembles the Global.
- `fields/`: owns declarative Payload field configurations.
- `validators/`: owns pure business validation.
- RowLabel components: own display summaries only.
- `hooks/`: owns Next.js cache invalidation only.
- `src/fields/link.ts`: remains the single shared link implementation.

Exact filenames may be adjusted during planning only to match an already-established local naming convention, without changing these responsibilities.

## Data Flow

1. An authenticated editor opens the Header Global.
2. Payload renders the configured native fields and conditional sections.
3. The editor sorts and configures up to eight top-level navigation items and an optional CTA.
4. Client-side Payload validation provides immediate feedback.
5. The same rules run server-side when the Global is updated through Admin, REST, GraphQL, or Local API.
6. Payload stores one Header document and returns the generated typed shape through its APIs.
7. `revalidateHeader` invalidates the existing Header cache tag after a successful update.
8. Frontend consumers may adopt the new shape in a separate, explicitly scoped project.

## Error Handling

- Invalid configurations are rejected before persistence with actionable messages.
- Relationship and custom URL validation remains owned by the shared link field configuration.
- The Header validator does not mutate submitted data or delete inactive conditional values.
- Cache revalidation runs only after a successful update and respects the existing `disableRevalidate` request context.
- API consumers must treat missing optional descriptions, supporting links, and CTA data as normal states.

## Compatibility and Migration

- Keep the Global slug `header` and field name `navItems`.
- Existing simple Header rows must be migrated into `navigationType: directLink` rows without losing link data.
- The Admin label remains `Header`.
- The shared `link()` default behavior remains unchanged for existing consumers.
- Generated Payload types and the Admin import map must be regenerated after schema changes.
- No frontend rendering change is included; the implementation plan must ensure schema tests do not assume the old frontend has already migrated.

## Testing Strategy

### Configuration tests

- Header remains a public-readable, authenticated-update Global with versions disabled.
- `navItems` has `maxRows: 8`, generated interfaces, native conditions, and RowLabel paths.
- All three navigation types expose the correct conditional fields.
- Dropdown items allow all three types in any order.
- Menu CTA and all Header link positions use the shared link factory.
- Header-specific links allow the four approved relationship targets and custom URLs.
- Existing non-Header `link()` calls retain their default relationship targets.

### Validation tests

- Accept valid direct-link, dropdown-only, and hybrid items.
- Reject missing Direct Links for applicable types.
- Reject empty Dropdowns for applicable types.
- Accept mixed default, featured, and list items.
- Reject missing featured/list tags or landing links.
- Ignore inactive conditional groups.
- Produce stable, actionable error messages.

### Integration checks

- Generate Payload types and the Admin import map successfully.
- Confirm the Header Global schema loads in the Admin Panel.
- Save representative data through Payload and read back the expected API shape.
- Confirm the existing Header cache revalidation hook still runs.
- Run focused integration tests, type checking, linting, and the relevant broader test suite.

## Acceptance Criteria

- Editors can manage zero to eight ordered top-level navigation items.
- Each item explicitly supports Direct Link, Dropdown, or both.
- A Dropdown contains at least one item and freely mixes default, featured, and list types.
- Every link supports internal references and custom URLs.
- Header references can target Pages, Posts, Case Studies, and Categories without changing other link consumers.
- The CTA remains independently configurable.
- Invalid combinations cannot be saved through Admin or APIs.
- The implementation primarily uses Payload configuration and small isolated helpers.
- Existing Header identifiers and cache behavior remain compatible.
- Frontend Header rendering remains unchanged in this scope.
