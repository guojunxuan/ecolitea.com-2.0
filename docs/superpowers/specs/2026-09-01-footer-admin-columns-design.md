# Footer Admin Columns Design

## Goal

Redesign the Payload Admin `footer` global so it manages only grouped footer navigation. All non-navigation footer content will remain owned by the existing `site-settings` global.

This change is limited to the CMS schema and its supporting generated types, Admin row labels, and focused schema tests. It must not change the frontend Footer component or its rendering behavior.

## Ownership Boundary

The `footer` global owns one field only:

- `columns`: ordered navigation groups for the footer.

The `site-settings` global remains the single source of truth for branding, contact details, social links, company identity, and legal or copyright content. This design does not duplicate those fields in `footer`.

Newsletter fields are not introduced in this scope because they are not part of the agreed Footer navigation array and do not currently have an established owner in `site-settings`.

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

The schema allows at most four columns and at most eight links per column. These limits keep the eventual desktop and mobile footer navigation manageable while still covering the old project's structure.

## Existing Data

The current Footer global stores a flat `navItems` array. Changing the schema does not attempt to reinterpret those links automatically because there is no reliable way to infer column titles or grouping.

Implementation will change the schema contract only. Existing flat data may remain in the database as unused legacy data until an explicit content migration or manual Admin update is performed. No database mutation is authorized by this design.

## Frontend Exclusion

`src/Footer/Component.tsx` remains unchanged. It can continue reading the old generated property until the separately scoped frontend Footer redesign is implemented. Consequently, the project may temporarily have a schema/frontend mismatch after type generation; implementation must avoid broadening this task to resolve the mismatch by editing frontend rendering.

If generated types make the existing frontend fail TypeScript compilation because `navItems` no longer exists, the implementation plan must stop and report that boundary conflict rather than silently modifying the frontend. The preferred resolution is to separate schema verification from frontend migration and obtain approval for the next scope.

## Validation and Testing

Focused schema tests will verify:

- `footer` exposes `columns` and no longer defines top-level `navItems`;
- `columns` has `minRows: 1` and `maxRows: 4`;
- column `label` is required;
- nested `navItems` has `minRows: 1` and `maxRows: 8`;
- nested links reuse the shared link field;
- the Footer revalidation hook remains configured;
- the frontend Footer component is not modified in this task.

Payload types and the Admin import map will be regenerated only as required by the schema and row-label changes. Relevant focused tests and static checks will be run, with known sandbox restrictions for Payload/MongoDB handled using the already established test procedure.

## Out of Scope

- Frontend Footer layout, styling, rendering, responsiveness, or accessibility changes.
- Reading `columns` in the frontend Footer.
- Reading additional Site Settings fields in the frontend Footer.
- Adding or moving Site Settings fields.
- Newsletter behavior or subscription integrations.
- Populating, migrating, or deleting Footer records in the database.
- Changing Header navigation.
