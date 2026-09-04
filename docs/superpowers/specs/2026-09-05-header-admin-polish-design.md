# Header Admin Polish Design

**Date:** 2026-09-05

## Objective

Finish the Payload Admin data model and editing experience for the `header` Global before any frontend adaptation begins. The result must be general-purpose, practical, configuration-first, and consistent with this repository's existing Payload architecture.

This work deliberately replaces the current Header data instead of supporting the temporary nested Direct Link shape. Existing Header content in the current development database will be cleared after the schema changes; no production data-clearing migration or compatibility reader is required.

## Scope

### Included

- Secure Header updates with the existing authenticated access policy.
- Replace both three-option Select fields with native horizontal Radio fields.
- Flatten the top-level Direct Link from `link.link` to a single `link` group.
- Make the menu CTA explicitly optional through an enable checkbox.
- Add clear Admin labels and singular/plural Array labels.
- Mark conditionally required fields accurately in the Admin UI.
- Normalize relevant strings before validation and persistence.
- Validate URL formats, conditional completeness, Array bounds, labels, and duplicate destinations.
- Preserve Payload's native Array editing actions while rejecting invalid results at save time.
- Update focused tests, generated Payload types, and the Admin import map.
- Clear only the Header content in the current development database once the new schema is ready.

### Excluded

- Frontend Header rendering or responsive behavior.
- Footer, Social, Branding, Contact, or Legal behavior.
- A compatibility layer or production migration for the old `link.link` shape.
- Custom Header views, drawers, modals, or replacements for Payload's native field controls.
- Automatic deletion of data hidden by a conditional field.
- Entering the final Header navigation content before the Admin work is complete.

## Design Principles

1. Prefer Payload field configuration, native controls, hooks, and validators over custom UI.
2. Keep shared capabilities opt-in. A Header requirement must not silently change every consumer of a shared field factory.
3. Keep Header-specific policy under `src/Header`; keep reusable mechanics in the existing shared module that owns that mechanic.
4. Follow the repository's current file and directory conventions instead of creating a parallel architecture.
5. Keep modules focused: declarative field configuration, pure validation, normalization, Row Labels, and cache invalidation remain separate responsibilities.
6. Preserve inactive conditional values for editorial recovery, but treat only the active discriminator branch as meaningful.

## Data Model

```text
Header
├── Navigation Items (0–8)
│   └── Navigation Item
│       ├── Label *
│       ├── Navigation Type * (horizontal Radio)
│       │   ├── Direct Link
│       │   ├── Dropdown
│       │   └── Direct Link + Dropdown
│       ├── Direct Link (conditional)
│       └── Dropdown (conditional)
│           ├── Description
│           ├── Description Links (0–3)
│           └── Dropdown Items * (1–12)
│               ├── Type * (horizontal Radio; defaults to Default)
│               ├── Default Item
│               ├── Featured Item
│               │   ├── Tag *
│               │   ├── Landing Link *
│               │   ├── Content
│               │   └── Navigation Links (0–4)
│               └── List Item
│                   ├── Tag *
│                   ├── Landing Link *
│                   └── Navigation Links * (1–8)
├── Enable Menu CTA Button
└── Menu CTA Button (conditional)
```

An asterisk means the field is required when its branch is active. Optional Arrays do not carry an asterisk, but every row created inside them must be complete. `Description` and Featured `Content` are optional.

### Navigation Items

The stored Array name remains `navItems` and its generated interface remains `HeaderNavItem`.

- Admin labels: `Navigation Items` / `Navigation Item`.
- Zero to eight sortable rows.
- Rows are initially collapsed.
- `label` is required.
- `navigationType` is a required native Radio field with horizontal layout.
- `navigationType` defaults to `directLink`.
- Stored values remain `directLink`, `dropdown`, and `directLinkAndDropdown`.

The Row Label displays the one-based row number, normalized Label, and readable Navigation Type. A missing Label falls back to the row number and type.

### Single-level Direct Link

The Direct Link uses the existing `link()` field factory directly. Its Admin condition is supplied through configuration rather than wrapping it in another named Group.

The resulting shape is:

```text
navigationItem.link.type
navigationItem.link.reference | navigationItem.link.url
navigationItem.link.newTab
```

The obsolete `navigationItem.link.link` shape is not supported. The Navigation Item Label is the link's display name, so the nested Link Label remains disabled.

### Dropdown

The named `dropdown` Group remains because it gives the API a clear business boundary.

- `description` is optional.
- `descriptionLinks` is labeled `Description Links` / `Description Link` and permits zero to three rows.
- `items` is labeled `Dropdown Items` / `Dropdown Item` and requires one to twelve rows whenever the Dropdown branch is active.

Every link row inside an optional Array is fully required once that row exists.

### Dropdown Item Types

The stored discriminator remains `type`, but it becomes a required native horizontal Radio field. It defaults to `default`.

- **Default:** required labeled link and optional Description.
- **Featured:** required Tag and Landing Link, optional Rich Text stored as `label` but displayed as `Content`, and zero to four Navigation Links.
- **List:** required Tag and Landing Link, and one to eight Navigation Links.

Landing Links have no independent Link Label because the Tag supplies the group's visible business name. Default, Description, Featured, and List link rows retain required Link Labels.

### Optional Menu CTA

Add an `enableMenuCta` checkbox labeled `Enable Menu CTA Button`, defaulting to `false`.

The existing `menuCta` link group is shown and validated only when the checkbox is enabled. When enabled it requires a Link Label and a valid destination. Disabling the CTA hides but does not erase its content, and disabled CTA content is ignored by validation and duplicate checks.

## Admin Editing Experience

Use Payload's native Radio, Checkbox, Array, Group, conditional fields, validation errors, sorting, and Row Label components. No custom state-selection field is introduced.

The following native Array operations remain available wherever Payload exposes them:

- Add Below
- Duplicate
- Copy Row
- Paste Below
- Replace Row
- Remove
- Drag Sort

These operations may create an intermediate duplicate or incomplete row. They are not disabled; saving is rejected with a location-specific message until the row is corrected.

Changing a Navigation Type or Dropdown Item Type hides inactive branches without deleting their values. Switching back restores the editor's earlier input. Row Labels, normalization-independent business validation, duplicate checks, APIs, and future frontend consumers use only the active branch.

## String Normalization

A Header-owned pre-persistence hook normalizes relevant strings without embedding Header rules into the shared link factory.

Trim leading and trailing whitespace from:

- Navigation Item Labels;
- Featured and List Tags;
- Link Labels;
- Custom URLs.

Do not change case, collapse internal whitespace, or rewrite URLs. Do not normalize textarea Description or Rich Text Content values.

Normalization traverses both active and inactive Header branches so restored data is consistently clean. Validation determines which branch is currently meaningful.

## Shared Custom URL Validation

Extend the existing `link()` field factory with an optional configuration flag or validator option. Header and Footer explicitly enable it; existing unrelated link consumers retain their current behavior.

Accepted trimmed Custom URL forms are:

- `http://...`
- `https://...`
- `/relative-path`
- `#anchor`
- `mailto:...`
- `tel:...`

Empty strings, plain unqualified text, and unsupported schemes are rejected. The reusable URL validator owns syntax recognition; Header validation owns Header-specific completeness and location-aware error reporting.

## Validation Rules

Validation runs in both Admin and server-side APIs.

### Access

- Header read access remains public.
- Header update access uses the repository's existing `authenticated` function.

### Labels and Conditional Completeness

- A Navigation Item Label must remain non-empty after trimming.
- Navigation Item Labels must be unique within `navItems` after trimming and are case-sensitive.
- `About` conflicts with ` About `, while `About` and `ABOUT` are distinct.
- Direct Link requires an active valid destination.
- Dropdown requires one to twelve Dropdown Items.
- Direct Link + Dropdown requires both branches to be complete.
- Default requires its labeled link.
- Featured requires a non-empty Tag and valid Landing Link.
- List requires a non-empty Tag, valid Landing Link, and one to eight Navigation Links.
- Menu CTA is ignored while disabled and must be complete while enabled.
- Inactive branches do not cause completeness errors.

### Destination Identity

Internal references are identified by collection plus document ID. The ID resolver supports both raw IDs and populated relationship objects.

Custom URLs are identified by their trimmed stored value. URL identity is case-sensitive and performs no trailing-slash or semantic URL normalization.

### Duplicate Scopes

- Active top-level Direct Links must be unique across Navigation Items.
- Each Dropdown is a separate duplicate scope.
- Within one Dropdown, compare Description Links, Default links, Featured/List Landing Links, and their Navigation Links together.
- Different Dropdowns may reuse a destination.
- A top-level Direct Link may also be the landing destination for content inside its own Dropdown.
- Menu CTA may reuse any navigation destination.
- Inactive branches are excluded from duplicate checks.

Errors identify the top-level Navigation Item and, where applicable, the nested Dropdown Item or Array row involved.

## Configuration and Module Boundaries

Follow the current repository structure:

```text
src/Header/
├── config.ts
├── fields/
│   ├── navigationItems.ts
│   ├── dropdown.ts
│   └── dropdownItems.ts
├── validators/
│   └── validateNavigation.ts
├── hooks/
│   ├── normalizeHeader.ts
│   └── revalidateHeader.ts
├── RowLabel.tsx
└── DropdownItemRowLabel.tsx

src/fields/
└── link.ts
```

Use `normalizeHeader.ts` for the normalization hook; do not collapse its responsibility into `config.ts` or the Row Label components.

- `config.ts` assembles fields, access, and hooks.
- `fields/` declares Payload configuration and conditions.
- `validators/` contains pure Header business validation and destination identity helpers.
- the normalization hook transforms strings only.
- Row Labels summarize current form data only.
- `revalidateHeader` remains responsible only for cache invalidation.
- `link.ts` exposes reusable, opt-in Custom URL validation configuration without importing Header code.

## Development Data Reset

After the new schema and generated artifacts are ready, clear only the current development database's Header content:

```text
header.navItems = []
header.enableMenuCta = false
header.menuCta = empty
```

Use the project's normal Payload data-access path rather than direct database-specific SQL where practical. Resolve the exact current development target before mutation. Do not touch Footer, Site Settings, Social Platforms, collections, or any deployed environment.

No production migration, compatibility transformation, or old-shape fallback is added.

## Error Handling

- Prefer Payload's built-in field errors for local required and row-count constraints.
- Use the focused Header validator for discriminator-aware completeness, label uniqueness, and destination uniqueness.
- Use actionable, one-based locations in cross-field errors.
- Never delete inactive content as a side effect of validation or normalization.
- Cache revalidation runs only after a successful Header update and continues to respect the existing request context.

## Testing

Focused automated coverage must verify:

- public read and authenticated update access;
- native horizontal Radio configuration and defaults;
- single-level Direct Link data shape and conditions;
- Admin Array labels, singular labels, bounds, and conditional asterisks;
- optional Menu CTA enable, disable, incomplete, and restore behavior;
- trimming without case conversion or internal-whitespace rewriting;
- the opt-in Custom URL protocol allowlist without changing unrelated `link()` consumers;
- conditional completeness for all three Navigation Types and Dropdown Item Types;
- case-sensitive normalized Navigation Item Label uniqueness;
- internal reference and Custom URL destination identity;
- every accepted duplicate scope and exception;
- inactive-branch preservation and exclusion from validation;
- native Duplicate, Paste, and Replace results being rejected when they violate saved-state rules;
- current-branch Row Label summaries and fallbacks;
- the empty Header state after the development reset;
- regenerated Payload types and Admin import map.

Verification remains scoped so concurrently developed Social or Footer work is not staged or attributed to this change.

## Success Criteria

The Header Admin opens and saves cleanly from an empty state; all required fields are visibly and conditionally marked; editors select both kinds of three-state behavior without dropdown controls; Direct Links expose a single-level API shape; optional content remains genuinely optional; invalid, duplicate, or malformed navigation cannot be persisted; native Array operations remain usable; shared behavior stays opt-in and low-coupled; and no frontend adaptation or unrelated data is changed.
