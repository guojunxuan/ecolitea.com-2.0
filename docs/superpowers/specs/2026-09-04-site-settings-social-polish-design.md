# Site Settings Social Polish Design

## Goal

Finish the Site Settings Social administration workflow without adding frontend Header or Footer rendering. Remove the remaining production seed helper, make Social Platform identity and editing rules explicit, simplify Social Link data, and make nested create/edit flows reliable.

## Scope

This work includes:

- removing `seedSocialSettings` and its production seed module;
- moving any test-only media fixture out of `src/endpoints/seed`;
- removing the optional `label` field from Site Settings `socialLinks`;
- showing the related Platform name as each Social Link row label;
- enforcing exact-value Platform name uniqueness;
- making a Platform name immutable after creation;
- enforcing a required SVG Icon on create and update;
- improving create/edit error, loading, success, and nested navigation behavior;
- updating generated Payload artifacts and focused tests.

Frontend social-link rendering, Header/Footer adaptation, a separate Platform management page, analytics, SEO fields, automatic asset cleanup, and cascading asset deletion remain out of scope.

## Data Model

### Social Platform

`social-platforms` remains a reusable collection with two business fields:

- `platform`: required text, used as the Admin title;
- `icon`: required relationship to an SVG Brand Asset.

`platform` is unique by its persisted exact value. This work does not introduce case folding or a normalized comparison key. The create UI may reject an empty or whitespace-only value, but the database-backed unique constraint is authoritative for concurrent requests.

After creation, `platform` is immutable. The Admin edit form renders it read-only, and a server-side hook rejects attempts to modify it through REST, GraphQL, or the Local API. The Icon remains editable.

### Social Link

Each Site Settings Social Link contains only:

- `platform`: required relationship to `social-platforms`;
- `url`: required absolute HTTP or HTTPS URL.

The former optional `label` is removed. The related Platform name is the single display-name source. Analytics should use the relationship ID or a future dedicated stable key rather than a duplicated display label.

Existing stored `label` values become unused schema residue in MongoDB and are not migrated in this task. Payload will omit the field from future reads and writes after the generated schema changes.

## Validation and Integrity

Platform validation is enforced at the server boundary, not only in Admin components:

- creation requires a non-empty Platform name;
- exact duplicate names are rejected;
- update requests cannot change the persisted Platform name;
- creation and update require an Icon;
- the Icon must resolve to a Brand Asset whose MIME type is `image/svg+xml`;
- clearing the Icon and saving must fail without showing a success state.

The current relationship-field edit/delete mechanism remains in place. Deleting a Platform does not cascade to its Brand Asset, and changing the Icon does not delete the previous Brand Asset. No separate management screen or custom deletion policy is added.

## Social Link Row Labels

The `socialLinks` array receives a RowLabel component. It resolves the current relationship value and displays the related Platform name.

Fallback labels are deterministic:

- no selection: `Unselected platform`;
- unresolved or deleted relationship: `Unavailable platform`;
- loading state: retain a stable generic Social Link label rather than exposing a raw document ID.

Creating or selecting a Platform refreshes the row label without requiring a full page reload.

## Create and Edit Experience

### Create Platform

The create action remains available from Site Settings Social and from the Platform relationship control. The form:

- clearly labels Platform and Icon;
- validates before submission;
- disables Save while submitting;
- prevents duplicate submissions;
- keeps entered values and the modal open after a failed request;
- presents Payload validation, duplicate, authorization, and network errors in the dialog;
- closes only after a confirmed successful response;
- automatically selects the created Platform when creation began from a Social Link relationship;
- shows a success notification when creation began from the top-level action.

The implementation replaces the current timer-based close-and-reopen workaround with an explicit modal lifecycle that does not lose form state.

### Edit Platform

Editing continues through the edit affordance in the Platform relationship input. The Platform name is visible but read-only, accompanied by guidance that it cannot be changed after creation. Editors may replace the Icon.

Saving an invalid or empty Icon keeps the edit interface open and reports the error. Successful Icon changes refresh the relationship display and Social Link row label.

### Nested Navigation

Opening a nested create screen from Editing Social Platform creates a parent-child navigation stack. Back or Cancel from the nested create screen returns to Editing Social Platform with its existing state intact. It must not close the parent edit interface or return directly to Site Settings.

Normal Cancel from the top-level create dialog closes that dialog and clears its draft. Successful completion closes only the completed layer.

## Seed Removal

`seedSocialSettings` is removed because it has no runtime caller after deletion of `/next/seed` and still hard-codes brand and social records. Tests that exist only to verify this helper are removed or rewritten around the collection and Global contracts.

The production `src/endpoints/seed` directory is removed completely. Any binary used by E2E setup is relocated under `tests/fixtures` and remains test-only.

New environments are configured through Payload Admin. A future deployment bootstrap, if required, must be designed separately as an explicit and environment-owned operation without hard-coded demo content.

## Error Handling

Errors are displayed at the closest actionable field when possible and summarized in the active dialog when they are not field-specific. A failed operation never displays success, closes the active editor, clears valid user input, or mutates the relationship value.

Duplicate-name errors use a stable editor-facing message. Server responses remain the source of truth; client checks may improve responsiveness but cannot replace server enforcement.

## Testing

Focused automated coverage will verify:

- exact duplicate Platform names are rejected;
- distinct exact values remain allowed without case-insensitive normalization;
- Platform names cannot be changed after creation through server APIs;
- missing, cleared, unresolved, and non-SVG Icons are rejected on create and update;
- invalid saves remain open and do not show success;
- successful relationship-origin creation selects the new Platform;
- top-level creation reports success;
- Social Links no longer expose `label` in the Payload schema or generated type;
- Social Link row labels display Platform names and stable fallback states;
- nested Back and Cancel restore Editing Social Platform with its draft intact;
- `/next/seed`, the demo Dashboard action, static demo homepage fallback, and the production seed module remain absent;
- the Payload import map and generated types remain current.

Final verification includes focused component tests, integration tests with MongoDB, TypeScript checks scoped to this work, import-map/type generation, and a production build when the existing out-of-scope frontend type failures no longer block it or can be isolated accurately.

## Acceptance Criteria

- Social Platform names are exact-value unique and immutable after creation.
- A Platform cannot be saved without a valid SVG Icon.
- Failed create or edit attempts remain editable and never report success.
- Social Links contain only Platform and URL business fields.
- Social Link rows show the related Platform name.
- Platform creation and editing preserve the correct parent interface across nested navigation.
- Editors continue to manage and delete Platforms through the relationship field's existing edit affordance.
- Platform/Icon deletion semantics are unchanged and never cascade.
- No production demo seed route, UI, content module, or helper remains.
- No Header/Footer frontend adaptation is included.
