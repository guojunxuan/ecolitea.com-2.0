# Footer Admin Polish Design

## Goal

Finish the Payload Admin data model and editing experience for Footer navigation while keeping the Footer frontend unchanged. The result should support minimal sites with no navigation, structured sites with up to four navigation columns, consistent Header/Footer relationship targets, and clear validation without replacing Payload's native Array interface.

## Scope

This work changes only the Footer Global schema, its reusable navigation field modules, Footer-specific Admin row labels, generated Payload artifacts, and focused tests.

It does not:

- adapt `src/Footer/Component.tsx` to render `columns`;
- read branding, contact, social, legal, or company fields from Site Settings;
- change Header navigation;
- change Site Settings Social fields or Social Platform components being completed in another session;
- migrate or delete legacy MongoDB `footer.navItems` data;
- replace Payload's native Array field interface.

## Data Model

The Footer Global owns one optional navigation structure:

```text
columns (array, optional, 0-4 rows)
  label (text, required for an existing row)
  navItems (array, required, 1-8 rows)
    link
      type: reference or custom
      reference or URL
      label
      newTab
```

A Footer with zero Columns is valid. Once an editor adds a Column, that row must have a valid Label and at least one valid Navigation Link.

The persisted field names remain `columns`, `label`, `navItems`, and `link`. Only editor-facing labels are normalized, so this work does not create an unnecessary data migration.

## Admin Naming

Editor-facing names use consistent title case and explicit singular/plural labels:

| Persisted field | Admin field label | Singular row label | Plural row label |
| --- | --- | --- | --- |
| `columns` | `Navigation Columns` | `Navigation Column` | `Navigation Columns` |
| `columns[].label` | `Label` | n/a | n/a |
| `columns[].navItems` | `Navigation Links` | `Navigation Link` | `Navigation Links` |
| `columns[].navItems[].link` | `Link` | n/a | n/a |

Required markers therefore appear as `Label *` and `Navigation Links *`, rather than `Column heading *` and the ambiguous `Links *`.

## Link Targets

Footer internal links support the same relationship targets as Header:

- Pages;
- Posts;
- Case Studies;
- Categories.

The Footer supplies these targets to the shared `link()` factory through its existing `relationTo` option. The shared factory's default targets remain unchanged for non-Footer consumers.

Custom Footer URLs support:

- absolute `https://` URLs;
- absolute `http://` URLs;
- root-relative paths beginning with `/`;
- page anchors beginning with `#`;
- `mailto:` URLs;
- `tel:` URLs.

Empty values, whitespace-only values, protocol-relative URLs, unsafe schemes such as `javascript:`, and unsupported schemes are rejected. Values are trimmed before persistence. This URL policy is Footer-specific and does not silently alter other shared-link consumers.

## Normalization and Validation

Footer validation is enforced at the schema/server boundary so Admin, REST, GraphQL, and Local API writes follow the same rules.

### Column Labels

- Labels are trimmed before persistence.
- An existing Column cannot have an empty or whitespace-only Label.
- Two Columns cannot have the same trimmed Label.
- Comparison remains case-sensitive: `Products` and `products` are distinct values.
- Duplicate errors identify the conflicting Column rows when possible.

### Link Labels

- Link display Labels are trimmed before persistence.
- A Navigation Link cannot have an empty or whitespace-only display Label.
- Existing shared link behavior remains intact outside Footer.

### Duplicate Destinations

Within one Column, a destination may appear only once:

- an internal reference is identified by `relationTo` plus document ID;
- a Custom URL is identified by its trimmed exact string;
- the Link display Label does not affect destination identity.

The same internal destination or Custom URL may appear in different Columns. Custom URL comparison does not normalize case, trailing slashes, fragments, or query parameters beyond trimming.

Validation ignores incomplete rows only long enough to provide the more direct required-field errors. It must not throw when relationship values arrive in either ID form or populated `{ relationTo, value }` form.

## Array Behavior

Footer retains Payload's native Array controls because Column and Navigation Link copying can be useful when constructing related navigation groups:

- Add Below;
- Duplicate;
- Copy Field and Paste Field;
- Copy Row;
- Paste Below;
- Replace Row;
- Remove;
- drag sorting;
- Move Up and Move Down.

Duplicate or paste operations may temporarily create an invalid draft. Saving is blocked by the server validation with actionable Column and Navigation Link row information. No Footer-specific replacement of Payload's Array UI is introduced.

Limits are:

- Navigation Columns: zero to four;
- Navigation Links within an existing Column: one to eight.

Payload's normal max-row behavior controls when Add, Duplicate, or Paste Below are unavailable.

## Row Labels

Columns and Navigation Links start collapsed to keep the Global compact.

Column rows display the trimmed Label directly. An incomplete row falls back to `Navigation Column NN`, using a one-based, zero-padded row number.

Navigation Link rows display, in order of preference:

1. the trimmed Link display Label;
2. the populated internal document title when it is safely available in current form state;
3. the trimmed Custom URL;
4. `Navigation Link NN`.

Row labels never expose a raw relationship ID. They remain presentation-only and do not fetch data independently for every collapsed row. If the relationship is stored only as an ID and no display Label is present, the stable fallback is used until Payload supplies populated display data.

## Access and Cache Behavior

Footer remains publicly readable and explicitly requires an authenticated user for updates. It continues using the existing `revalidateFooter` after-change hook and keeps versions disabled.

## Reusable Field Boundary

`navigationColumns()` continues to own the stable reusable `columns` structure. It accepts top-level and nested Array overrides. Footer-specific limits, relationship targets, validation, descriptions, Admin labels, and RowLabel component paths are composed without changing unrelated users of the shared field factory.

Pure helpers for normalization, URL validation, destination identity, and duplicate detection live with the Footer or reusable navigation field according to ownership. Helpers must not import React or Admin UI modules, allowing direct integration tests.

## Existing Data

The previous flat top-level `footer.navItems` field remains unused legacy database data. This Admin-polish work does not infer Column names, migrate records, or mutate the database.

Existing `columns` data remains structurally compatible. When an editor next saves the Global, new trim, URL, and duplicate rules apply. Invalid legacy values remain readable but must be corrected before a successful update.

## Testing

Focused automated coverage verifies:

- zero Columns is valid;
- more than four Columns is rejected by Payload's Array constraints;
- an existing Column requires a trimmed non-blank Label;
- duplicate trimmed Column Labels are rejected with case-sensitive comparison;
- a Column requires one to eight Navigation Links;
- Footer links support Pages, Posts, Case Studies, Categories, and Custom URLs;
- non-Footer `link()` consumers retain their default relationship targets;
- supported Custom URL forms are accepted and unsupported or unsafe forms are rejected;
- Footer Custom URLs and display Labels are trimmed before persistence;
- duplicate internal and Custom URL destinations are rejected within one Column;
- the same destination is accepted in different Columns;
- populated and ID-only relationships are validated without throwing;
- Admin singular/plural labels match the approved terminology;
- native Payload Array actions remain available;
- Column and Navigation Link RowLabels display approved values and fallbacks without raw IDs;
- public read, authenticated update, cache revalidation, and disabled versions remain configured;
- generated Payload types and the Admin import map are current;
- no Footer frontend or Site Settings Social source is modified.

## Acceptance Criteria

- Editors can save a Footer with no Navigation Columns.
- Editors can manage up to four named Columns with one to eight Navigation Links each.
- Footer internal-link targets match Header targets without changing shared defaults.
- Custom URLs support the six approved forms and reject unsafe schemes.
- Column and Link labels are trimmed and cannot be blank.
- Column Labels are unique after trimming with case-sensitive comparison.
- Destinations are unique within a Column and may repeat across Columns.
- Payload's native Array operations remain intact.
- Admin terminology consistently uses Navigation Column, Label, and Navigation Link.
- RowLabels remain useful in incomplete states and never expose raw IDs.
- Footer updates explicitly require authentication and continue invalidating the Footer cache.
- No frontend Footer, Header, or Site Settings Social adaptation is included.
