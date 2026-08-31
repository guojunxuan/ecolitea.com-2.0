# Site Settings Global design

## Goal

Add a `site-settings` Payload Global that gives editors one native Admin form for site-wide business information. This phase only defines and registers the form. It does not connect the data to the frontend, Header, Footer, metadata, or inquiry flow.

## Scope

The Global contains five presentational tabs:

- General
- Branding
- Contact
- Social
- Legal

The tabs are unnamed Payload tabs. They organize the Admin form without nesting persisted data, so fields remain top-level properties in the Local API, REST API, GraphQL API, and generated TypeScript type.

Default SEO and inquiry settings are explicitly out of scope. A default social or Open Graph image is also excluded because it belongs to the deferred SEO design.

## Payload architecture

Use a `GlobalConfig` because Site Settings is a singleton. Register it in the root Payload config alongside Header and Footer.

Use Payload's built-in fields and generated Admin UI. Do not introduce custom Admin components, client components, plugins, or frontend form code.

Organize the configuration as:

```text
src/SiteSettings/
├── config.ts
└── fields/
    ├── branding.ts
    ├── contact.ts
    ├── general.ts
    ├── index.ts
    ├── legal.ts
    └── social.ts
```

Each field module exports one tab configuration. `fields/index.ts` composes the five tabs, while `config.ts` only defines Global-level concerns and consumes the composed field configuration.

## Field schema

### General

| Field | Payload type | Required | Notes |
| --- | --- | --- | --- |
| `siteName` | `text` | Yes | Public-facing site or brand name |
| `legalCompanyName` | `text` | No | Registered company name |
| `tagline` | `text` | No | Short brand statement |
| `siteDescription` | `textarea` | No | General company/site description; not an SEO default |

### Branding

| Field | Payload type | Required | Notes |
| --- | --- | --- | --- |
| `logo` | `upload` | Yes | Relationship to `media` |
| `logoDark` | `upload` | No | Alternative for dark backgrounds; relationship to `media` |
| `favicon` | `upload` | No | Browser/site icon; relationship to `media` |

### Contact

| Field | Payload type | Required | Notes |
| --- | --- | --- | --- |
| `salesEmail` | `email` | No | Sales contact address with Payload's native email validation |
| `phone` | `text` | No | String preserves country codes and formatting |
| `whatsapp` | `text` | No | String preserves country codes and formatting |
| `address` | `textarea` | No | Postal/business address |
| `businessHours` | `textarea` | No | Free-form hours including timezone when needed |

### Social

| Field | Payload type | Required | Notes |
| --- | --- | --- | --- |
| `socialLinks` | `array` | No | Repeatable social destinations |
| `socialLinks.platform` | `select` | Yes per row | Options defined in a reusable configuration constant |
| `socialLinks.label` | `text` | No | Optional editor-controlled display label |
| `socialLinks.url` | `text` | Yes per row | Uses a small reusable absolute-URL validator |

Initial platform options are LinkedIn, Facebook, Instagram, YouTube, WhatsApp, WeChat, and Xiaohongshu. The options live with the Social field configuration rather than in rendering code, and can be extended without changing the stored shape.

### Legal

| Field | Payload type | Required | Notes |
| --- | --- | --- | --- |
| `copyrightText` | `text` | No | Editor-managed copyright statement |
| `companyRegistrationNumber` | `text` | No | Registration identifier where applicable |
| `privacyPolicyPage` | `relationship` | No | Single relationship to `pages` |
| `termsPage` | `relationship` | No | Single relationship to `pages` |

## Access control

Reuse the project's shared access functions:

- `read: anyone` so the settings can later be consumed by the public website through Payload APIs.
- `update: authenticated` so only authenticated CMS users can modify the Global.

Payload Globals do not create or delete multiple documents; the Global is a singleton updated in place.

## Hooks and caching

Do not add hooks in this phase. The form has no frontend consumer, cached reader, external synchronization, or other required side effect. Adding an `afterChange` hook now would introduce unused behavior.

When a frontend consumer is added later, it should use the project's typed global reader and a `global_site-settings` cache tag. That later change can add a focused `afterChange` cache invalidation hook at the same time.

## Components

Do not add custom components. Native Tabs, Text, Textarea, Email, Upload, Array, Select, and Relationship fields cover the current requirements. This minimizes coupling to Payload Admin internals and reduces upgrade surface.

## Data shape

Because all five tabs are unnamed, the resulting shape remains flat:

```ts
{
  siteName: string
  legalCompanyName?: string | null
  tagline?: string | null
  siteDescription?: string | null
  logo: number | Media
  logoDark?: number | Media | null
  favicon?: number | Media | null
  salesEmail?: string | null
  phone?: string | null
  whatsapp?: string | null
  address?: string | null
  businessHours?: string | null
  socialLinks?: Array<{
    platform: string
    label?: string | null
    url: string
    id?: string | null
  }> | null
  copyrightText?: string | null
  companyRegistrationNumber?: string | null
  privacyPolicyPage?: number | Page | null
  termsPage?: number | Page | null
}
```

Exact generated relation ID types remain controlled by Payload and the configured database adapter.

## Validation and editor guidance

Use native Payload validation wherever available. Required fields are limited to the minimum necessary to identify the site and its primary logo. Social rows require a platform and URL. URL validation accepts absolute `http:` and `https:` URLs and returns a clear field-level error for invalid input.

Use field and tab descriptions for editor guidance rather than a custom instructional component. Avoid data transformation hooks and silent normalization in this phase.

## Verification

Implementation verification will include:

1. Generate Payload TypeScript types using the repository's `generate:types` script.
2. Run the TypeScript/build validation available in the repository.
3. Run lint checks scoped appropriately to the change.
4. Confirm the generated `SiteSettings` type is flat rather than grouped under tab names.
5. Confirm the Global appears in the Payload Admin navigation and uses only native fields.
6. Confirm unauthenticated reads are allowed and unauthenticated updates are denied by the configured access functions.

## Deferred work

- Connecting settings to Header, Footer, metadata, or other frontend components
- Default SEO configuration
- Inquiry configuration or inquiry form integration
- Localization
- Cache reads and cache invalidation hooks
- Role-specific permissions beyond the project's current authenticated-user model
- Custom Admin components or live preview
