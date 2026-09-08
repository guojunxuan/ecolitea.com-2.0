# Site Settings Content Design

## Goal

Make Site Settings the typed source of truth for public identity, contact information, newsletter presentation, and social platform assets while keeping frontend display concerns out of Payload.

## General

`siteName`, `legalCompanyName`, `siteDescription`, and `tagline` are required, trimmed, non-blank fixed fields. `customFields` is an optional Payload Array for display-only additions. Each row contains required, trimmed `label` and `value` fields; no machine key is stored.

## Contact

`address`, `phone`, and `salesEmail` are required. `whatsapp` and `businessHours` are removed from the schema and frontend model. `contactCustomFields` is an optional display-only Array with the same `label` and `value` row contract as General.

Footer contact icons are frontend-owned Lucide components: `MapPin`, `Phone`, and `Mail`. They are decorative inline SVGs, are not uploaded to R2, and inherit the Footer foreground color.

## Newsletter

Newsletter settings live in a named `newsletter` Group inside the Contact tab:

- `enabled`: visible checkbox, default `true`.
- `heading`: visible only when enabled, required and non-blank.
- `description`: visible only when enabled, required and non-blank.
- `emailPlaceholder`: stored and returned by Payload, hidden only in Admin, required, default `Email address`.
- `buttonLabel`: stored and returned by Payload, hidden only in Admin, required, default `Subscribe`.

No Form relationship, submission, subscription collection, or email integration is added. When disabled, the complete Newsletter section is absent from the public Footer. Existing text is retained.

## Social

Site Settings keeps the existing `socialLinks` Array and relationship to the reusable hidden `social-platforms` Collection. Social icon files remain SVG Brand Assets stored through R2. The icon field explains that uploaded artwork must be designed for dark backgrounds. The Footer renders the uploaded artwork without CSS color inversion.

## Branding

The fixed dark Footer consumes `logoDark` first and falls back to `logo`. `logoDark` continues to mean “Logo for Dark Backgrounds,” not a website theme. Existing Logo files that are absent from R2 must be re-uploaded or migrated; frontend code must not redirect all Brand Assets through local disk as a workaround.

## Cached Global Queries

Components do not choose relationship depths. `getCachedHeader`, `getCachedFooter`, and `getCachedSiteSettings` are the standard query functions and centrally own slug, depth, cache key, and tag. Site Settings uses depth 2 so Social Platform icons are populated. Header, Footer, and root metadata consume these standard functions.

## Compatibility

Use Payload-native field names and types, regenerate `payload-types.ts`, add no dependencies, retain unnamed tabs so existing Site Settings properties stay flat, and keep custom display fields optional so existing data remains valid.

