# Footer Admin Columns Design

## Goal

Redesign the Payload Admin `footer` global so it manages only grouped footer navigation. All non-navigation footer content will remain owned by the existing `site-settings` global.

This change is limited to the CMS schema and its supporting generated types, Admin row labels, and focused schema tests. It must not change the frontend Footer component or its rendering behavior. The frontend is intentionally migrated in the immediately following task, so this Admin-only stage may temporarily leave the existing frontend consumer incompatible with the newly generated Footer type.

## Ownership Boundary

The `footer` global owns one field only:

- `columns`: ordered navigation groups for the footer.

The `site-settings` global remains the single source of truth for branding, contact details, social links, company identity, and legal or copyright content. This design does not duplicate those fields in `footer`.

Newsletter fields are not introduced in this scope because they are not part of the agreed Footer navigation array and do not currently have an established owner in `site-settings`.

## Reusable Field Module

The navigation structure will be implemented as a reusable, typed field factory rather than as an inline object in the Footer global:

```text
src/fields/navigationColumns.ts
src/Footer/RowLabel.tsx
```

`navigationColumns()` accepts the field name, label, Payload-style row bounds, nested `navItems` bounds, and optional row-label component paths. It composes the existing shared `link()` field factory without depending on Footer. Footer-specific row-label components remain in the existing Footer domain directory and are passed into the factory as configuration.

The array sets `interfaceName: 'NavigationColumns'` so Payload generates a stable reusable TypeScript and GraphQL array type for the complete navigation-columns value.

## Data Model

Replace the current top-level `navItems` array with this structure:

```text
columns (array, required, 1-4 rows)
  label (text, required)
  navItems (array, required, 1-8 rows)
    link
      type: reference or custom
      reference or URL
      label
      newTab
```

Each `columns` row represents one visible navigation group such as `Products`, `Company`, or `Resources`. Each nested `navItems` row uses the project's shared `link` field so link behavior remains consistent with Header and other CMS-managed links.

The array order is authoritative: column order controls future visual ordering, and nested link order controls the order within a column.

## Payload Admin Experience

- The Footer global displays only the `columns` array.
- Columns start collapsed to keep the editor compact.
- Each column row label uses its `label` value and falls back to `Navigation group`.
- Nested navigation items start collapsed.
- Each nested row uses the existing shared link editor and displays the link label through a dedicated Footer link row label where needed.
- Admin descriptions explain that branding, social, contact, company, and copyright content are managed in Site Settings.

The Footer config passes one to four columns and one to eight links per column to the field factory. These business limits remain configuration inputs rather than hard-coded behavior inside the reusable module.

## Existing Data

The current Footer global stores a flat `navItems` array. Changing the schema does not attempt to reinterpret those links automatically because there is no reliable way to infer column titles or grouping.

Implementation removes `navItems` from the Payload schema and replaces it with `columns`. Existing flat data may remain in MongoDB as unused legacy data until an explicit content migration or cleanup is authorized. No database mutation is authorized by this design.

## Frontend Exclusion

`src/Footer/Component.tsx` remains unchanged. Payload types are regenerated from the new schema, so TypeScript is expected to identify the existing frontend's `footer.navItems` access as the known boundary to be resolved by the immediately following frontend Footer task. This known transitional failure does not authorize editing frontend rendering in the Admin-only task.

## Validation and Testing

Focused schema tests will verify:

- `footer` exposes `columns` and no longer defines top-level `navItems`;
- `columns` has `minRows: 1` and `maxRows: 4`;
- column `label` is required;
- nested `navItems` has `minRows: 1` and `maxRows: 8`;
- nested links reuse the shared link field;
- the reusable field factory honors configured bounds and exposes `interfaceName`;
- the Footer revalidation hook remains configured;
- the frontend Footer component is not modified in this task.

Payload types and the Admin import map will be regenerated from the schema. Relevant focused tests and static checks will be run. Full frontend type/build verification is deferred to the immediately following frontend task because its known consumer still uses the removed field.

## Out of Scope

- Frontend Footer layout, styling, rendering, responsiveness, or accessibility changes.
- Reading `columns` in the frontend Footer.
- Reading additional Site Settings fields in the frontend Footer.
- Adding or moving Site Settings fields.
- Newsletter behavior or subscription integrations.
- Populating, migrating, or deleting Footer records in the database.
- Changing Header navigation.
