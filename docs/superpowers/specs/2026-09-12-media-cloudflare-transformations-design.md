# Media Cloudflare Transformations Design

## Context

The application uses Payload upload collections with `@payloadcms/storage-s3` and a Cloudflare R2 bucket. The `media` collection currently asks Payload and Sharp to generate several derived image sizes during upload. Frontend components then ignore those derived sizes and render the original `url` through `next/image`, causing image optimization to happen in the Next.js application.

This change makes R2 the source of original assets and moves delivery-time image and video transformations to Cloudflare. Payload remains responsible for asset management and upload validation. Business components describe presentation needs without knowing Cloudflare URL syntax.

This work is based on `chore/site-settings-and-site-shell` and is developed on `codex/media-cloudflare-transformations`.

## Design principles

### Configuration over hardcoding

Values that represent policy or reusable presentation behavior live in typed configuration rather than being repeated inside hooks and components. This includes:

- accepted image ratios and their tolerance;
- video container, codec, duration, and file-size limits;
- default image quality and format behavior;
- named presentation presets used by current business consumers.

The configuration is application source code reviewed and deployed with the site. It is not editor-managed Payload content. Values that are inherently environment-specific continue to come from the existing environment layer.

### Low coupling and provider-neutral interfaces

Business components express presentation intent using application terms such as `aspectRatio`, `fit`, `quality`, and responsive `sizes`. They do not import a Cloudflare adapter, refer to `/cdn-cgi/`, or construct provider option strings.

The shared Media layer exposes the provider-neutral contract. A Cloudflare-specific URL adapter implements that contract internally. This boundary allows the delivery provider or URL syntax to change without changing Block schemas or business renderers.

### Existing project conventions

The implementation follows the repository's current organization:

- Payload collection configuration remains under `src/collections`;
- reusable Media rendering code remains under `src/components/Media`;
- general URL helpers remain under `src/utilities` only when they are not Media-specific;
- business presentation choices remain beside their existing render components in `src/blocks`, `src/heros`, and `src/components/Card`;
- integration tests remain under `tests/int` and browser behavior tests remain under `tests/e2e`;
- imports use the existing `@/` alias and exported configuration uses the project's `as const` and `satisfies` patterns where they improve type safety.

No package source files or generated dependency files are modified.

## Scope

The development environment uses the existing `R2_PUBLIC_URL` value:

```text
https://media-dev.ecolitea.com
```

Production configuration and rollout are outside this change.

The change covers:

- the Payload `media` upload collection;
- image, video, and document delivery from the shared Media renderer;
- presentation requirements declared by existing frontend consumers;
- development data cleanup and generated Payload types;
- tests for URL generation, validation, Admin behavior, and existing consumers.

The `brand-assets` collection remains on its current original-file delivery path. Its SVG logos and social icons and its SVG, PNG, or ICO favicon assets do not use Cloudflare Transformations.

## Architecture

### Storage and database contract

`@payloadcms/storage-s3` continues to perform upload and delete operations against R2. R2 stores only the uploaded original/master file for new `media` documents.

Payload stores the original R2 URL and native upload metadata such as filename, MIME type, file size, width, and height. Transformation URLs and presentation-specific dimensions are never persisted in Payload.

The following upload-time image behavior is removed from `media`:

- `imageSizes`;
- `adminThumbnail: 'thumbnail'`;
- focal-point editing;
- Payload resize and crop configuration.

Sharp remains configured in Payload so Payload can inspect raster dimensions. Removing derived image sizes does not require modifying Payload, Sharp, `@payloadcms/storage-s3`, or files in `node_modules`.

### Admin delivery

Payload Admin always uses the original asset URL. Admin list thumbnails, upload-field previews, and relationship-field previews do not generate `/cdn-cgi/image/` or `/cdn-cgi/media/` URLs.

The `media` collection uses the original document URL as its Admin thumbnail. Admin behavior is kept separate from the public frontend Media renderer.

### Frontend delivery

The public frontend dispatches resources by MIME category:

```text
image    -> R2 original -> /cdn-cgi/image/ -> Cloudflare cache -> browser
video    -> R2 original -> /cdn-cgi/media/ -> Cloudflare cache -> browser
document -> R2 original -------------------> Cloudflare cache -> browser
```

Only frontend consumption creates a transformation URL.

For an original image URL on the configured R2 origin:

```text
https://media-dev.ecolitea.com/photos/card.jpg
```

the renderer uses a same-origin pathname source:

```text
https://media-dev.ecolitea.com/cdn-cgi/image/width=640,height=480,fit=cover,quality=85,format=auto/photos/card.jpg
```

The renderer derives the transformation host from the original asset URL. It does not hard-code `media-dev.ecolitea.com` and does not introduce a second transformation-host environment variable.

For image transformation URLs, same-origin assets use the pathname and retain any source query string needed for versioning. The URL builder encodes and orders options deterministically so equivalent presentation requirements produce the same Cloudflare cache key.

Media Transformations requires its documented source syntax. The video URL builder uses a full source URL where Cloudflare requires one, even though image transformations prefer a same-origin pathname.

Local static imports do not use the Cloudflare Media renderer path and retain their existing Next.js behavior.

## Component responsibilities

### Business consumers

Business components declare presentation needs using provider-neutral Media props. They do not construct Cloudflare URLs or pass raw Cloudflare option strings.

The presentation contract supports the requirements needed by current consumers:

- intended aspect ratio when server-side crop is required;
- fit behavior;
- quality;
- responsive HTML `sizes`;
- optional delivery width hints for video.

Fixed design decisions live in the business component's frontend renderer. They are not Payload schema fields. A future Block may expose an editor-selectable layout option, but it must map that content-level choice to the same renderer contract.

Repeated fixed requirements use named, typed presentation presets exported by the Media layer. A business renderer selects a preset and may add its HTML `sizes` value; it does not duplicate numeric Cloudflare settings. A one-off requirement may use the same provider-neutral options directly when introducing a named preset would add no reuse.

Examples of ownership:

- a Card renderer declares its card ratio and cover behavior;
- a Hero renderer declares its hero presentation requirements;
- the generic body Media Block preserves the original aspect ratio unless its own design explicitly requires a crop;
- SEO metadata continues to consume the original URL in this change.

CSS layout and Cloudflare transformation have distinct roles. Existing `object-cover` styles continue to control the rendered element. A business component only requests a Cloudflare crop when it has a known target ratio and dimensions; the shared renderer does not infer a crop from CSS class names.

### Shared Media renderer

The shared Media component selects image or video rendering based on the resource MIME type. `ImageMedia` and `VideoMedia` translate the provider-neutral presentation contract into Cloudflare options.

The image renderer:

- reads the original Payload URL and intrinsic dimensions;
- preserves the original ratio by default;
- generates responsive Cloudflare URLs through the `next/image` loader interface for Payload-hosted raster images;
- uses `format=auto` and a default quality of `85`;
- adds height and `fit=cover` only when a consumer explicitly provides a target ratio;
- leaves local static imports on the existing Next.js path.

The video renderer:

- uses the original Payload `url` rather than rebuilding `/media/${filename}`;
- builds `/cdn-cgi/media/` URLs at render time;
- preserves the original video by default and applies only explicitly declared delivery requirements.

Documents use the original URL without transformation.

### Configuration and adapter boundaries

The implementation keeps three configuration concerns separate:

1. Media upload policy defines accepted ratios, tolerance, and video limits for Payload validation.
2. Media presentation presets define reusable frontend intent such as card crop or original-ratio body media.
3. The Cloudflare adapter maps renderer intent to deterministic `/cdn-cgi/image/` and `/cdn-cgi/media/` URLs.

Upload policy does not import frontend presentation presets. Business components do not import upload validation or the Cloudflare adapter. `ImageMedia` and `VideoMedia` are the only components that connect the provider-neutral render contract to the provider adapter.

Following the current project layout, the expected source boundaries are:

```text
src/collections/Media.ts                  Payload collection composition
src/collections/mediaUploadPolicy.ts      typed upload rules and validation helpers
src/components/Media/types.ts             provider-neutral render contract
src/components/Media/config.ts            typed defaults and presentation presets
src/components/Media/cloudflare.ts        Cloudflare URL adapter
src/components/Media/ImageMedia/index.tsx image rendering integration
src/components/Media/VideoMedia/index.tsx video rendering integration
```

The implementation plan may keep a helper in its caller when it is only a few lines and has one consumer, but it must preserve these dependency directions.

## Upload validation

Validation runs only when a file is uploaded or replaced. Editing alt text, captions, folder relationships, or other document metadata does not revalidate an existing file.

### Images

Raster images that expose width and height must match one of the approved ratios configured in the Media upload policy. A ratio matches when `abs(actualRatio / allowedRatio - 1) <= configuredTolerance`; the initial tolerance is `0.01`, or 1 percent:

- `1:1`;
- `4:3`;
- `3:2`;
- `16:9`;
- `9:16`;
- `4:5`.

The validator reports the actual dimensions and the accepted ratios in a Payload validation error. It validates the original file and does not transform it.

SVG assets remain the responsibility of `brand-assets`. The normal `media` image-ratio path does not treat SVG as a raster image.

### Videos

New video uploads must satisfy the limits defined in the Media upload policy. The initial values follow the Cloudflare Media Transformations source constraints adopted for this project:

- MP4 container;
- H.264 video;
- AAC or MP3 audio when an audio track exists;
- no more than 100 MB;
- no longer than 10 minutes.

Validation reads container metadata with the pure-JavaScript `mp4box` package and does not transcode the upload. The parser inspects the MP4 duration and track codec identifiers (`avc1` for H.264 and `mp4a` or the parser's MP3 identifier for supported audio). This adds a project dependency but requires no system `ffprobe` binary and no native dependency patch. Invalid files receive a specific Payload validation error before persistence.

### Documents and other files

Non-image, non-video files retain Payload's current safe-file restrictions and are stored as originals. This change adds no new document MIME or size policy. They are delivered directly from the R2 custom domain and its Cloudflare CDN cache.

## Existing consumers and dependency impact

Existing upload relationships remain unchanged. Pages, Posts, Case Studies, Heroes, Media Blocks, and search records continue to reference the `media` collection.

No current frontend code reads `media.sizes.thumbnail`, `media.sizes.square`, `media.sizes.small`, `media.sizes.medium`, `media.sizes.large`, `media.sizes.xlarge`, or `media.sizes.og`. Removing those generated sizes therefore does not require a content schema migration for the consuming collections.

Consumer updates are limited to frontend presentation declarations where a component has a known requirement:

- Hero renderers retain their current layout and may declare a target crop only where the design defines one;
- Card renderers declare their responsive `sizes` and any fixed ratio;
- the body Media Block defaults to preserving the original ratio;
- SEO metadata keeps the original R2 URL;
- Rich Text continues to render through the existing Media Block and shared Media renderer.

`brand-assets`, Site Settings logo fields, favicon metadata, and social platform icons remain unchanged and use original URLs.

## Existing development assets

Existing development `media` documents and their old R2 derivatives may be removed because this is a development environment. Cleanup excludes all `brand-assets` objects.

Cleanup is performed through Payload's collection operations wherever possible so the configured storage adapter owns file deletion. Before deletion, the cleanup operation produces an inventory of target Media documents, original filenames, known derivative filenames, and referencing documents. The cleanup may leave Pages, Posts, and Case Studies with empty or stale relationships unless those development documents are also reset or re-seeded, so the implementation plan must include an explicit reference cleanup or reseed step.

The generated Payload TypeScript definitions are regenerated after `imageSizes` is removed. No compatibility shim for the old `sizes` structure is required.

## Error handling and fallback behavior

Upload validation errors are returned before the Media document and original file are committed.

The frontend URL builder returns the original URL for unsupported MIME types and for URLs that cannot safely be represented as a transformation request. It must not emit a malformed `/cdn-cgi/` URL.

Cloudflare delivery failures remain visible as asset request failures; the application does not silently route transformed image requests back through the Next.js optimization endpoint. Original URLs remain available in Payload for diagnosis and rollback.

## Testing and acceptance criteria

Automated tests cover:

- accepted and rejected image ratios, including tolerance boundaries;
- metadata-only Media updates bypassing upload validation;
- MP4 size, duration, video codec, and audio codec validation;
- the absence of Payload `imageSizes`, focal-point behavior, and generated-size metadata;
- Admin thumbnail resolution to the original URL;
- deterministic image transformation URLs with same-origin pathname sources;
- upload and presentation behavior driven by typed configuration rather than repeated numeric literals;
- business consumers remaining independent of Cloudflare URL syntax;
- source paths containing spaces and query parameters;
- image renderer defaults that preserve aspect ratio;
- explicit Card or Hero crop requirements;
- video transformation URLs built from the stored original URL;
- documents and unsupported resources returning their original URL;
- local static images retaining their existing path;
- Header, Footer, favicon, and social icons continuing to use original `brand-assets` URLs;
- existing Page, Post, Case Study, Hero, Card, Media Block, Rich Text, search, and SEO integration behavior.

The implementation is accepted when:

1. A new Media upload creates only the original object in R2.
2. Payload and Payload Admin expose only the original URL for previews and relationships.
3. No Transformation URL is stored in MongoDB.
4. Public image and video consumers create valid Cloudflare URLs only at render time.
5. Different business consumers can render the same original with different presentation requirements.
6. Documents and `brand-assets` continue to use their original CDN URLs.
7. Existing integration and frontend tests pass after Payload types are regenerated.
