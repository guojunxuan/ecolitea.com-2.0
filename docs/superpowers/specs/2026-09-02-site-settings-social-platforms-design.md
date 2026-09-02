# Site Settings Social Platforms Design

## Goal

Replace the hard-coded social platform select options with database-backed social platform records that editors can create from the Site Settings Social tab, while preserving each social link's `platform`, optional `label`, and `url` semantics. Frontend Footer rendering is explicitly out of scope.

## Scope

This change covers only Payload configuration, Admin behavior, generated types, seed compatibility, and focused automated tests.

It does not change the frontend Footer, define social icon rendering, or redesign any public page.

## Data Model

### Social Platforms collection

Add a `social-platforms` collection with these fields:

- `name`: required text used as the Admin title, such as `LinkedIn`.
- `key`: required, unique text used as a stable machine-readable identifier, such as `linkedin`.
- `icon`: required upload relationship to `brand-assets`, filtered to SVG assets.

The collection is readable publicly because the eventual frontend Footer needs populated platform metadata. Create, update, and delete operations require authentication.

The collection is hidden from the primary Admin navigation. Editors manage its records through the `platform` relationship field in Site Settings. Payload's relationship drawer supplies the standard `Create New` workflow; no custom button or custom persistence endpoint is introduced.

### Site Settings social links

Keep `site-settings.socialLinks` as an array. Each row contains:

- `platform`: required relationship to `social-platforms`.
- `label`: optional text override for the public or accessible label.
- `url`: required absolute HTTP or HTTPS URL using the existing validation behavior.

Payload continues to generate an `id` for each array row. The relationship field stores a Social Platform document ID in MongoDB and can return either that ID or a populated Social Platform object according to query depth.

## Admin Workflow

1. An authenticated editor opens `Site Settings > Social`.
2. The editor adds or expands a Social Link array row.
3. The editor selects an existing platform from the `platform` relationship field.
4. If it does not exist, the editor uses Payload's standard `Create New` action in the relationship control.
5. The editor enters the platform name and key, uploads or selects an SVG icon through `brand-assets`, and saves the platform.
6. The new platform becomes selectable in the Social Link row and in future rows.
7. The editor optionally supplies a label, supplies the account URL, and saves Site Settings.

## Reuse and Coupling

Social platform identity and its icon are stored once and reused by any Social Link that references it. Account-specific data remains in Site Settings: the optional label and destination URL are not stored on the reusable platform record.

The existing hidden `brand-assets` upload collection remains the physical asset store. Site Settings manages the relationship to the platform, and the platform creation drawer manages the relationship to its SVG asset. This follows Payload's standard upload and relationship model instead of embedding files in a Global document.

No platform names or icon mappings remain hard-coded in `SiteSettings/fields/social.ts`. Adding a new platform requires database content only, not a code change or deployment.

## Validation and Access

- `name`, `key`, and `icon` are required on Social Platform records.
- `key` is unique so future rendering or integrations have a stable identifier.
- `icon` accepts only `image/svg+xml` assets from `brand-assets`.
- Social Link `url` retains the current absolute HTTP/HTTPS validator.
- Guests may read Social Platforms.
- Only authenticated users may create, update, or delete Social Platforms.
- Site Settings retains its existing public-read and authenticated-update access.

## Existing Data

Existing Social Link rows currently store a string in `platform`. The new field stores a relationship ID, so existing string values are not valid references. The implementation will update seed/sample data to use Social Platform records and will document that existing development data must be recreated or migrated before those rows can be edited successfully.

No automatic production migration is included because this branch is still establishing the new Site Settings structure and the user approved adopting the new model directly. The implementation must not silently invent platform records or icons for existing strings.

## Cache Behavior

Saving Site Settings continues to invalidate `global_site-settings`. The new Social Platforms collection does not add frontend cache invalidation in this scope because frontend rendering is deferred. Cache invalidation for platform updates will be added together with the frontend Footer data dependency so it can target the exact cache contract in use.

## Testing

Focused integration/configuration tests will verify:

- `social-platforms` is registered in the Payload configuration.
- Its access rules, hidden Admin configuration, title field, unique key, and SVG icon relationship are correct.
- Site Settings uses a required relationship field instead of a hard-coded select.
- The optional label and required validated URL remain present.
- Generated Payload types represent the new relationship correctly.

Tests will be written and observed failing before production configuration changes are made.

## Success Criteria

- An editor can create a new reusable platform from the Social Link platform control using Payload's standard `Create New` drawer.
- The platform and icon persist in the database and are available for selection in subsequent Social Link rows.
- A Social Link still consists of a platform, optional label, and URL.
- No frontend Footer code changes are included.
- Focused tests and Payload type generation complete successfully.
