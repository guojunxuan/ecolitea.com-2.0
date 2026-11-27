# Site Settings Social Polish Design

## Goal

Finish the Site Settings Social administration workflow without adding frontend Header or Footer rendering. Remove the remaining production seed helper, make Social Platform identity and editing rules explicit, simplify Social Link data, and make create/edit flows reliable within a single Drawer.

## Scope

This work includes:

- removing `seedSocialSettings` and its production seed module;
- moving any test-only media fixture out of `src/endpoints/seed`;
- removing the optional `label` field from Site Settings `socialLinks`;
- showing the related Platform name as each Social Link row label;
- enforcing exact-value Platform name uniqueness;
- making a Platform name immutable after creation;
- enforcing a required SVG Icon on create and update;
- replacing the custom Modal workflow with a single-Drawer create/edit experience;
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

Each Platform relationship may appear at most once in the `socialLinks` array. Platform collection uniqueness and Social Link relationship uniqueness solve different problems: the collection constraint prevents two Platform documents from sharing the same exact name, while the array constraint prevents one valid Platform document from being referenced by multiple Social Link rows.

## Validation and Integrity

Platform validation is enforced at the server boundary, not only in Admin components:

- creation requires a non-empty Platform name;
- exact duplicate names are rejected;
- update requests cannot change the persisted Platform name;
- creation and update require an Icon;
- the Icon must resolve to a Brand Asset whose MIME type is `image/svg+xml`;
- clearing the Icon and saving must fail without showing a success state.
- every non-empty Platform relationship ID may occur only once in Site Settings Social Links.

The Social Links uniqueness rule is enforced by an array-level validator and applies to Admin, REST, GraphQL, and Local API writes. It reports the duplicated Platform and affected row when that information is available. UI action visibility is an editing aid and is never treated as the integrity boundary.

The current relationship-field edit/delete mechanism remains in place. Deleting a Platform does not cascade to its Brand Asset, and changing the Icon does not delete the previous Brand Asset. No separate management screen or custom deletion policy is added.

## Social Link Row Labels

The `socialLinks` array receives a RowLabel component. It resolves the current relationship value and displays the related Platform name.

Fallback labels are deterministic:

- no selection: `Unselected platform`;
- unresolved or deleted relationship: `Unavailable platform`;
- loading state: retain a stable generic Social Link label rather than exposing a raw document ID.

Creating or selecting a Platform refreshes the row label without requiring a full page reload.

## Social Links Array Actions

The Social Links array keeps only actions that can produce a valid and useful state under the one-link-per-Platform rule:

- keep Add Below;
- keep drag sorting, Move Up, and Move Down;
- keep Remove;
- hide Duplicate;
- hide Copy Row;
- hide Paste Below;
- hide Replace Row;
- hide the array-level Copy Field and Paste Field actions.

Payload's clipboard compatibility check compares field structure but does not verify that a relationship still exists or that pasting preserves cross-row uniqueness. Site Settings is a singleton Global, so copying the complete field has no meaningful cross-document workflow. Row duplication and row paste would normally reproduce the same Platform relationship and immediately create invalid data.

The action restrictions are scoped only to Site Settings Social Links. Other Array fields retain Payload's standard action menu. The implementation uses an isolated custom Admin boundary for this field and avoids global CSS or global modification of Payload Array behavior.

## Create and Edit Experience

Social Platform creation and editing use one right-side Payload Drawer. The custom `SocialPlatformCreateModal`, its timer-based reopen behavior, and Modal-specific styles are removed. The flow never stacks one Social Platform Drawer on another and does not require a parent-child Drawer history.

### Create Platform

The create action remains available from Site Settings Social and from the Platform relationship control. Both entry points open the same Creating new Social Platform Drawer. The form:

- clearly labels Platform and Icon;
- validates before submission;
- disables Save while submitting;
- prevents duplicate submissions;
- keeps entered values and the Drawer open after a failed request;
- presents Payload validation, duplicate, authorization, and network errors in the Drawer;
- closes only after a confirmed successful response;
- automatically selects the created Platform when creation began from a Social Link relationship;
- shows a success notification when creation began from the top-level action.

The Icon field retains the current capabilities inside this Drawer: editors can select an existing Brand Asset or upload/create a new SVG. These actions stay within the active Social Platform Drawer from the editor's perspective and must not replace or close it prematurely.

### Edit Platform

Editing continues through the edit affordance in the Platform relationship input and opens the same single-Drawer form in edit mode. The Platform name is visible but read-only, accompanied by guidance that it cannot be changed after creation. Editors may select an existing Brand Asset or upload/create a new SVG Icon.

Saving an invalid or empty Icon keeps the Drawer open and reports the error. Successful Icon changes refresh the relationship display and Social Link row label.

### Drawer Navigation

Only one Social Platform Drawer is active. Back or Cancel from Create/Edit Social Platform closes that Drawer and returns directly to Site Settings Social. It must not close Site Settings or leave an invisible Modal active.

Cancel clears the active Social Platform draft. Successful completion closes the Drawer, refreshes available Platform options, and preserves the calling context so relationship-origin creation can select the new Platform.

## Seed Removal

`seedSocialSettings` is removed because it has no runtime caller after deletion of `/next/seed` and still hard-codes brand and social records. Tests that exist only to verify this helper are removed or rewritten around the collection and Global contracts.

The production `src/endpoints/seed` directory is removed completely. Any binary used by E2E setup is relocated under `tests/fixtures` and remains test-only.

New environments are configured through Payload Admin. A future deployment bootstrap, if required, must be designed separately as an explicit and environment-owned operation without hard-coded demo content.

## Error Handling

Errors are displayed at the closest actionable field when possible and summarized in the active Drawer when they are not field-specific. A failed operation never displays success, closes the active editor, clears valid user input, or mutates the relationship value.

Duplicate-name errors use a stable editor-facing message. Server responses remain the source of truth; client checks may improve responsiveness but cannot replace server enforcement.

## Testing

Focused automated coverage will verify:

- exact duplicate Platform names are rejected;
- distinct exact values remain allowed without case-insensitive normalization;
- Platform names cannot be changed after creation through server APIs;
- missing, cleared, unresolved, and non-SVG Icons are rejected on create and update;
- invalid saves keep the single Drawer open and do not show success;
- successful relationship-origin creation selects the new Platform;
- top-level creation reports success;
- Social Links no longer expose `label` in the Payload schema or generated type;
- Social Link row labels display Platform names and stable fallback states;
- duplicate Platform relationships are rejected regardless of whether they arrive through Admin or an API;
- Social Links expose Add Below, ordering, and Remove while omitting field/row copy, paste, replace, and duplicate actions;
- Array action restrictions do not affect unrelated Payload Array fields;
- Create and Edit use one Drawer, with Back and Cancel returning directly to Site Settings Social;
- selecting or creating an SVG Brand Asset does not close or replace the active Social Platform workflow;
- `/next/seed`, the demo Dashboard action, static demo homepage fallback, and the production seed module remain absent;
- the Payload import map and generated types remain current.

Final verification includes focused component tests, integration tests with MongoDB, TypeScript checks scoped to this work, import-map/type generation, and a production build when the existing out-of-scope frontend type failures no longer block it or can be isolated accurately.

## Acceptance Criteria

- Social Platform names are exact-value unique and immutable after creation.
- A Platform cannot be saved without a valid SVG Icon.
- Failed create or edit attempts remain editable and never report success.
- Social Links contain only Platform and URL business fields.
- A Platform can appear in at most one Social Link row.
- Social Link rows show the related Platform name.
- Social Links retain Add, ordering, and Remove actions without exposing invalid copy, paste, replace, or duplicate workflows.
- Platform creation and editing use one Drawer and return to Site Settings Social.
- Editors continue to manage and delete Platforms through the relationship field's existing edit affordance.
- Platform/Icon deletion semantics are unchanged and never cascade.
- No production demo seed route, UI, content module, or helper remains.
- No Header/Footer frontend adaptation is included.
