# Site Branding Logo integration design

## Goal

Connect the existing `site-settings` Branding fields to the public website so editors can manage the site logo and favicon from one place. Preserve SVG sharpness at every responsive size, keep rendering independent from Payload internals, and avoid custom Admin UI.

This phase does not add SEO, inquiry configuration, or future system/runtime Settings.

## Decisions

- Render uploaded SVG logos with a native `<img>` element.
- Do not inline CMS-provided SVG markup or use `dangerouslySetInnerHTML`.
- Keep full and dark-background logos as separate optional assets because an external SVG loaded through `<img>` cannot inherit page `currentColor`.
- Use CSS height plus automatic width for responsive sizing while preserving the SVG aspect ratio.
- Do not add a mobile `logoMark` field until the real Header layout proves it is needed.
- Show Site Settings in Payload's normal Globals area rather than grouping it under `Settings`.

## Storage and Admin management

Create a dedicated Payload Upload Collection named `brand-assets`.

The collection is hidden from the normal Admin navigation. It remains a native Upload Collection internally, so Payload owns file upload, metadata, URL generation, relationship handling, and storage adapter integration. Editors reach it only through the native Upload controls inside Site Settings / Branding:

```text
Site Settings / Branding
├── logo ────────┐
├── logoDark ────┼──> Brand Assets (hidden Upload Collection)
└── favicon ─────┘
```

This separation keeps general page and product images in the existing `media` Collection. It also avoids adding logo-specific filtering, permissions, or labels to the general media library.

Brand Assets is hidden as an editor navigation choice, not embedded into the Global document. Its records still exist independently in the database and remain available through Branding's native Choose Existing and Create New drawers.

## Branding schema

| Field | Required | Accepted asset | Fallback |
| --- | --- | --- | --- |
| `logo` | Yes | SVG | No Payload-branded fallback |
| `logoDark` | No | SVG | `logo` |
| `favicon` | No | SVG, PNG, or ICO | Existing static application favicon |

The two logo upload relationships use Payload `filterOptions` for `image/svg+xml`. The favicon relationship accepts the supported icon MIME types. The Brand Assets collection remains capable of storing all three allowed branding formats; validation at each relationship controls which assets can be assigned to each purpose.

The supplied `/Users/jason/Desktop/full logo.svg` and `/Users/jason/Desktop/icon.png` are test inputs. They are uploaded through Payload during verification and are not copied into source control as application fallbacks.

## Runtime data flow

```text
Brand Assets upload document
        ↓
Site Settings Branding relationship
        ↓
cached Site Settings reader (depth 1)
        ↓
brand asset resolver
        ↓
Header / Footer / root layout
        ↓
Logo.tsx or favicon link
```

Header, Footer, and root layout own data retrieval because they are already integration boundaries. `Logo.tsx` remains a pure presentation component and does not import Payload, query globals, or understand relationship IDs.

A small resolver converts Payload's relationship union (`id | BrandAsset`) into a stable presentation shape containing URL, alt text, width, and height. Missing or unexpanded relationships resolve to `null` instead of leaking Payload-specific branches into components.

## Logo component

`Logo.tsx` accepts resolved image data and standard presentation props. It renders a native `<img>` with intrinsic `width` and `height` when available. Those attributes reserve the correct aspect ratio and reduce layout shift; CSS controls the rendered size.

Typical responsive styling is height-led:

```tsx
className="block h-7 w-auto max-w-full sm:h-8 lg:h-10"
```

Because the source is SVG, changing the rendered dimensions does not rasterize or blur the logo. `w-auto` preserves the source aspect ratio. The component must not set unrelated fixed width and height values that distort the artwork.

The image uses meaningful alternative text when it is a content-bearing brand mark. A caller may pass an empty alt value when an adjacent accessible site name makes the image decorative.

## Header and Footer behavior

The Header receives resolved `logo` and `logoDark` data from its server boundary. The client-side Header may select the appropriate asset for its current background/theme without querying Payload.

The Footer uses `logoDark` when its background requires the inverse artwork and falls back to `logo`. Both locations render the shared `Logo.tsx` component and own only their layout-specific CSS classes.

If the required logo has not yet been populated in an existing database, the public component renders no image rather than displaying the current hard-coded Payload logo. Admin validation requires a logo on the next successful Site Settings save.

## Favicon behavior

The root layout reads the same cached Site Settings data and emits the configured favicon URL. When favicon is absent or unresolved, the application retains its existing static favicon. The favicon does not pass through `Logo.tsx` because it is document metadata rather than page content.

## Caching and hooks

Use the project's typed cached global reader with relationship depth `1`. Add a focused Site Settings `afterChange` hook that invalidates the `global_site-settings` cache tag, following the existing Header and Footer pattern.

The hook only invalidates cached reads. It does not transform uploaded files, copy values into components, or synchronize duplicate settings.

## Security and file quality

External SVG files are loaded as image resources. The implementation does not inject their markup into the page DOM, which avoids the sanitizer and XSS surface introduced by dynamically inlining CMS-controlled SVG.

MIME filtering ensures correct asset categories but cannot guarantee good visual composition. Editor descriptions should request a tight SVG `viewBox`, no excessive transparent canvas, and an appropriate horizontal logo ratio. The supplied SVG has a valid `viewBox`, contains vector paths, and contains no detected scripts, event handlers, remote resources, or embedded raster images.

## Verification

1. Generate Payload types after registering Brand Assets and changing relationships.
2. Test Branding field relationship targets, MIME filters, required state, and access behavior.
3. Upload the supplied SVG and PNG through Payload and assign them in Branding.
4. Confirm Brand Assets is absent from normal Admin navigation but its native relationship drawers work from Branding.
5. Confirm Header and Footer use the configured SVG and preserve its aspect ratio at mobile and desktop widths.
6. Confirm `logoDark` falls back to `logo` when absent.
7. Confirm the configured PNG favicon is emitted and the static fallback remains valid when absent.
8. Confirm saving Site Settings invalidates its cached global data.
9. Run focused integration tests, generated-type checks, and the production build.

## Deferred work

- Mobile-specific `logoMark`
- Inline SVG styling, path animation, or `currentColor` support
- SVG optimization or sanitization pipeline
- Automatic deletion of superseded brand assets
- SEO and social sharing defaults
- Inquiry settings
- Future system/runtime Admin Settings
