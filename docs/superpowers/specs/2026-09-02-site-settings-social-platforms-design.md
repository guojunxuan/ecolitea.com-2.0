# Site Settings Social Platforms Design

## Goal

Replace hard-coded social platform options with database-backed platform records that editors create and reuse from `Site Settings > Social`. Preserve each Social Link's `platform`, optional `label`, and `url` semantics while adding a configurable SVG icon. Frontend Footer rendering remains out of scope.

## Scope

This change covers the Social Platform data model, Site Settings Social fields, the Social Platform creation Modal in Payload Admin, generated Payload types, seed/sample data compatibility, and focused automated tests.

It does not change the public Footer, render social icons, add analytics, add SEO schema, or expose a Social Platforms item in the Admin navigation.

## Project Structure and Naming

All implementation files must follow the current repository's directory structure, import aliases, naming conventions, and responsibility boundaries. This feature must not introduce a new top-level architectural pattern.

The intended placement is:

```text
src/
  collections/
    SocialPlatforms.ts
  SiteSettings/
    fields/
      social.ts
    components/
      SocialPlatformCreateModal.tsx
      SocialPlatformCreateActions.tsx
tests/
  int/
    site-settings.int.spec.ts
```

Responsibilities follow existing conventions:

- `src/collections/SocialPlatforms.ts` owns only the reusable Payload Collection configuration, fields, access, and Admin metadata;
- `src/SiteSettings/fields/social.ts` owns only the Site Settings Social tab and its relationship/array configuration;
- `src/SiteSettings/components/` contains Admin UI that is specific to the Site Settings Social workflow;
- existing shared access functions such as `anyone` and `authenticated` are reused rather than duplicated;
- generated types remain in the existing `src/payload-types.ts` output;
- focused configuration and behavior coverage extends the existing `tests/int/site-settings.int.spec.ts` unless a separate test file is justified by size;
- imports use the repository's existing `@/` alias and current formatting rules.

Names use the system's established conventions: PascalCase for exported Collection and React component files, camelCase for fields and helpers, kebab-case Payload slugs, and user-facing labels in title case. Any implementation plan may split a component further only when it has a distinct responsibility and remains under `src/SiteSettings/components/`.

## Data Model

### Social Platforms collection

Register a `social-platforms` Collection in the root Payload configuration. It is a normal database model and API resource with these fields:

- `id`: generated automatically by Payload;
- `platform`: required text used as the Admin title, such as `LinkedIn`;
- `icon`: required upload relationship to `brand-assets`, filtered to SVG assets.

No additional `key` field is included. Payload's generated `id` is sufficient for the current internal relationship. A stable cross-environment key can be added later if analytics, external APIs, imports, or SEO integrations require one.

The Collection uses:

```ts
admin: {
  hidden: true,
  useAsTitle: 'platform',
}
```

`hidden: true` hides only the standalone Admin navigation entry. The Collection remains registered and available to MongoDB, Payload APIs, generated types, access control, and Site Settings relationships.

Guests may read platform records because the eventual frontend needs populated platform and icon data. Create, update, and delete operations require authentication.

### Site Settings Social Links

Keep `site-settings.socialLinks` as an array. Each row contains:

- `platform`: required relationship to `social-platforms`;
- `label`: optional text override for the eventual public or accessible label;
- `url`: required absolute HTTP or HTTPS URL using the existing validator.

Payload continues to generate an `id` for each Social Link array row. The relationship stores a Social Platform document ID and may return either that ID or a populated platform object according to query depth.

## Admin Information Architecture

Editors manage Social Links only from `Site Settings > Social`. `Social Platforms` does not appear as an independent item under Collections.

The Social tab contains:

- the existing Social Links array;
- a visible `Create Social Platform` action near the Social Links heading;
- a Platform relationship control in each Social Link row;
- a `Create Social Platform` action in the footer of the Platform relationship options popover;
- the existing `Add Social Link` array action.

Both platform creation entry points open the same Modal. They do not navigate to a standalone Collection page and do not open Payload's default half-width Document Drawer.

## Create Social Platform Modal

The Modal is intentionally compact because the platform document has only two business fields.

### Layout

- centered at approximately 520 pixels wide on desktop;
- responsive width with safe viewport margins on smaller screens;
- rendered through a top-level portal so its position is relative to the viewport, not the Admin content column;
- backdrop covers the complete Payload Admin, including its collapsible navigation sidebar;
- remains centered whether the Admin sidebar is expanded, collapsed, or replaced by the mobile menu;
- background content and navigation are inert while open.

### Content

The Modal contains:

- title: `Create Social Platform`;
- close control in the top-right;
- required `Platform` text input;
- required `Icon` upload relationship;
- SVG-only filtering for Icon;
- Payload-style Icon actions: `Create New`, `Choose from existing`, and drag-and-drop;
- footer actions aligned to the bottom-right: `Cancel`, then primary `Save`.

The Modal does not contain a key field, tabs, document metadata, publishing controls, or unrelated actions.

### Interaction

- `Cancel`, the close control, and `Escape` dismiss the Modal without creating a platform;
- `Save` validates required fields and creates the platform through Payload;
- validation errors remain inside the Modal and preserve entered values;
- saving from a Social Link row closes the Modal and assigns the newly created platform to that row;
- saving from the top-level Social action closes the Modal and refreshes available relationship options;
- focus is trapped inside the open Modal;
- closing returns focus to the entry point that opened it;
- double submission is prevented while saving.

## Payload Integration Boundary

Payload continues to own the `social-platforms` Collection schema, authentication and access control, server-side validation, database persistence, SVG upload relationships through `brand-assets`, generated API and TypeScript types, and relationship value storage.

Payload's Relationship field normally uses a Document Drawer for `allowCreate`. This design disables that default creation action to avoid two competing creation experiences:

```ts
admin: {
  allowCreate: false,
}
```

A focused custom Admin component owns only the Modal presentation, the two creation entry points, submission state, and relationship refresh or assignment. It does not reimplement Payload's database model, permissions, or the general Social Link array.

Because Payload does not expose an official option for replacing the default Relationship create Drawer with a custom Modal, the implementation must keep the customization local to Site Settings Social. It must not apply global click interception, global Drawer CSS overrides, or modifications to Payload package files.

## Data Flow

1. Payload loads Site Settings and available Social Platform relationships.
2. The editor opens the Modal from the Social heading or a Social Link relationship context.
3. The editor enters `platform` and creates, selects, or uploads an SVG Brand Asset for `icon`.
4. Save submits the platform through an authenticated Payload operation.
5. Payload validates and persists the Social Platform document.
6. The Admin UI refreshes platform options.
7. If the Modal was opened for a specific Social Link row, that row receives the new platform ID.
8. Site Settings saves `platform`, optional `label`, and `url` in its Social Link array.

## Validation and Access

- Social Platform `platform` is required.
- Social Platform `icon` is required and restricted to `image/svg+xml` Brand Assets.
- Social Link `platform` is required.
- Social Link `label` remains optional.
- Social Link `url` retains the current absolute HTTP/HTTPS validator.
- Guests may read Social Platforms.
- Only authenticated users may create, update, or delete Social Platforms.
- Site Settings retains public read and authenticated update access.

## Existing Data

Existing Social Link rows currently store a select string in `platform`. The new relationship stores a Social Platform document ID, so the existing values are not valid relationships.

The implementation will update seed/sample data to create the necessary platform and SVG asset records before assigning Social Link relationships. It will not silently invent platform records or icons for unknown existing values.

No production migration is included because this branch is still establishing the new Site Settings structure and the user approved adopting the new data model directly. Existing development Social data must be recreated or explicitly migrated before editing those rows.

## Cache Behavior

Saving Site Settings continues to invalidate `global_site-settings`. Social Platform updates do not add frontend cache invalidation in this scope because the public Footer does not yet consume the relationship. Platform cache invalidation will be added with the frontend Footer implementation against the exact data-fetching contract used there.

## Testing

Tests will be written and observed failing before production implementation. Focused tests will cover:

- registration of `social-platforms` in the Payload configuration;
- hidden Admin navigation and `platform` as the Admin title;
- public read and authenticated write access;
- required Platform and SVG-only Icon fields;
- Site Settings using a required Relationship instead of a hard-coded Select;
- preservation of optional Label and validated URL;
- disabling the default Relationship create Drawer;
- Modal open and cancel behavior;
- Modal validation and error preservation;
- successful platform creation;
- relationship refresh and row assignment after creation;
- Modal accessibility behavior where practical;
- generated Payload types for the new Collection and relationship.

## Success Criteria

- Editors can create reusable Social Platforms without leaving Site Settings.
- Both creation entry points open one consistent compact Modal.
- The Modal covers the entire Admin context, including the collapsible sidebar.
- Cancel and Save appear at the bottom-right in that order.
- Successful row-context creation automatically selects the new platform.
- Platform and Icon persist in the database and are reusable in later Social Links.
- Social Link data remains `platform + optional label + url`.
- Social Platforms remains absent from standalone Admin navigation.
- No public Footer code changes are included.
- Focused tests and Payload type generation complete successfully.
