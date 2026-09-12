# Media Cloudflare Transformations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store only original Media assets in development R2, validate uploads in Payload, and generate provider-specific Cloudflare image and video transformation URLs only when the public frontend renders an asset.

**Architecture:** Payload owns original-file lifecycle and uses typed upload-policy helpers. Business renderers pass provider-neutral presentation presets into the shared Media component; only a Cloudflare adapter inside that component knows `/cdn-cgi/` syntax. Payload Admin, SEO metadata, documents, and `brand-assets` continue to use original URLs.

**Tech Stack:** Payload 4 canary, Next.js 16.3.3, React 19, TypeScript 6, Vitest, Playwright, `@payloadcms/storage-s3`, Sharp, `mp4box` 1.4.6, Cloudflare R2, Cloudflare Images Transformations, Cloudflare Media Transformations.

**Spec:** `docs/superpowers/specs/2026-09-12-media-cloudflare-transformations-design.md`

## Global Constraints

- Development `R2_PUBLIC_URL` is `https://media-dev.ecolitea.com`; production rollout is outside scope.
- R2 stores only original/master files for new `media` uploads.
- Payload and Payload Admin always use original URLs; Transformation URLs are never persisted.
- Images are transformed only during public frontend rendering via `/cdn-cgi/image/`.
- Videos are transformed only during public frontend rendering via `/cdn-cgi/media/`.
- Documents and `brand-assets` use original CDN URLs.
- Image ratios are configured as `1:1`, `4:3`, `3:2`, `16:9`, `9:16`, and `4:5`, with relative tolerance `0.01`.
- Videos must be MP4/H.264, at most 100 MB and 10 minutes, with AAC or MP3 audio when audio exists.
- Business consumers use provider-neutral presentation props and never construct Cloudflare URLs.
- Follow existing `src/collections`, `src/components/Media`, `src/blocks`, `src/heros`, `tests/int`, and `tests/e2e` conventions.
- Do not modify Payload, Sharp, storage adapter, or other dependency source files.

---

## File map

- `src/collections/mediaUploadPolicy.ts`: typed upload constants, image-ratio validation, video policy evaluation, and Payload upload-hook composition.
- `src/collections/parseMP4Metadata.ts`: adapt an uploaded MP4 buffer to normalized duration and track codec metadata through `mp4box`.
- `src/collections/Media.ts`: compose the Media collection, original-URL Admin thumbnail, and upload validation hook; remove generated sizes.
- `src/components/Media/types.ts`: provider-neutral image/video presentation contract.
- `src/components/Media/config.ts`: frontend defaults and named presentation presets.
- `src/components/Media/cloudflare.ts`: deterministic Cloudflare image/video URL construction.
- `src/components/Media/ImageMedia/index.tsx`: connect Payload raster images to the Cloudflare adapter through the Next Image loader.
- `src/components/Media/VideoMedia/index.tsx`: render transformed video from the stored original URL.
- Existing Hero, Card, and Media Block components: select named presentation presets and HTML responsive `sizes`.
- `scripts/cleanup-development-media.ts`: inventory and optionally delete development Media through Payload, guarded by the expected origin.
- `tests/int/*.int.spec.ts[x]`: policy, adapter, renderer, consumer, Admin, SEO, and brand-assets regression tests.

---

### Task 1: Typed image upload policy

**Files:**
- Create: `src/collections/mediaUploadPolicy.ts`
- Create: `tests/int/media-upload-policy.int.spec.ts`

**Interfaces:**
- Produces: `MEDIA_UPLOAD_POLICY`, `validateImageDimensions(width, height): true | string`.
- Consumes: no application modules.

- [ ] **Step 1: Write failing image-policy tests**

Cover exact ratios, the 1 percent boundary, a ratio outside the boundary, and invalid dimensions:

```ts
import { describe, expect, it } from 'vitest'
import { MEDIA_UPLOAD_POLICY, validateImageDimensions } from '@/collections/mediaUploadPolicy'

describe('Media image upload policy', () => {
  it.each([[1000, 1000], [1600, 1200], [1500, 1000], [1920, 1080], [1080, 1920], [1200, 1500]])(
    'accepts configured dimensions %sx%s',
    (width, height) => expect(validateImageDimensions(width, height)).toBe(true),
  )

  it('uses the configured relative tolerance', () => {
    expect(MEDIA_UPLOAD_POLICY.image.ratioTolerance).toBe(0.01)
    expect(validateImageDimensions(1009, 1000)).toBe(true)
    expect(validateImageDimensions(1011, 1000)).toMatch(/Accepted ratios/)
  })

  it('rejects missing or non-positive dimensions', () => {
    expect(validateImageDimensions(0, 100)).toMatch(/dimensions/)
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-upload-policy.int.spec.ts`

Expected: FAIL because `@/collections/mediaUploadPolicy` does not exist.

- [ ] **Step 3: Implement the typed policy and validator**

Use integer ratio pairs so configuration remains readable and no floating constants are duplicated:

```ts
export const MEDIA_UPLOAD_POLICY = {
  image: {
    ratios: [
      { label: '1:1', width: 1, height: 1 },
      { label: '4:3', width: 4, height: 3 },
      { label: '3:2', width: 3, height: 2 },
      { label: '16:9', width: 16, height: 9 },
      { label: '9:16', width: 9, height: 16 },
      { label: '4:5', width: 4, height: 5 },
    ],
    ratioTolerance: 0.01,
  },
  video: {
    maxBytes: 100 * 1024 * 1024,
    maxDurationSeconds: 10 * 60,
    mimeTypes: ['video/mp4'],
    videoCodecPrefixes: ['avc1', 'avc3'],
    audioCodecPrefixes: ['mp4a.40.', 'mp4a.69', 'mp4a.6a', 'mp4a.6b', 'mp3', '.mp3'],
  },
} as const

export const validateImageDimensions = (width?: number | null, height?: number | null) => {
  if (!width || !height || width <= 0 || height <= 0) return 'Image dimensions could not be read.'
  const actual = width / height
  const matched = MEDIA_UPLOAD_POLICY.image.ratios.some(({ width: w, height: h }) =>
    Math.abs(actual / (w / h) - 1) <= MEDIA_UPLOAD_POLICY.image.ratioTolerance,
  )
  return matched || `Image is ${width}×${height}. Accepted ratios: ${MEDIA_UPLOAD_POLICY.image.ratios.map(({ label }) => label).join(', ')}.`
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/collections/mediaUploadPolicy.ts tests/int/media-upload-policy.int.spec.ts
git commit -m "feat: define media upload policy"
```

---

### Task 2: MP4 metadata parsing and video validation

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `src/collections/parseMP4Metadata.ts`
- Modify: `src/collections/mediaUploadPolicy.ts`
- Modify: `tests/int/media-upload-policy.int.spec.ts`

**Interfaces:**
- Produces: `ParsedMP4Metadata`, `parseMP4Metadata(buffer: Buffer): Promise<ParsedMP4Metadata>`, `validateVideoMetadata(metadata): true | string`.
- Consumes: `MEDIA_UPLOAD_POLICY.video` from Task 1 and `createFile` from `mp4box`.

- [ ] **Step 1: Add the exact parser dependency**

Run: `corepack pnpm add mp4box@1.4.6 --save-exact`

Expected: `package.json` and `pnpm-lock.yaml` add the package without modifying native build configuration.

- [ ] **Step 2: Write failing parser and video-policy tests**

Test normalized metadata independently from policy decisions. Inject a small `createFile` fake into an internal parser helper so tests exercise callback and duration normalization without binary fixtures:

```ts
expect(validateVideoMetadata({
  durationSeconds: 599,
  audioCodecs: ['mp4a.40.2'],
  videoCodecs: ['avc1.640028'],
})).toBe(true)

expect(validateVideoMetadata({
  durationSeconds: 601,
  audioCodecs: ['mp4a.40.2'],
  videoCodecs: ['avc1.640028'],
})).toMatch(/10 minutes/)

expect(validateVideoMetadata({
  durationSeconds: 20,
  audioCodecs: ['opus'],
  videoCodecs: ['hev1'],
})).toMatch(/H.264/)
```

Also test that `duration / timescale` is returned in seconds and parser errors reject the promise.

- [ ] **Step 3: Run the focused test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-upload-policy.int.spec.ts`

Expected: FAIL because the parser and video validator are absent.

- [ ] **Step 4: Implement MP4 normalization**

Convert the Node buffer to an exact ArrayBuffer, attach `fileStart = 0`, call `appendBuffer()` and `flush()`, then normalize tracks:

```ts
export type ParsedMP4Metadata = {
  durationSeconds: number
  videoCodecs: string[]
  audioCodecs: string[]
}

const normalizeInfo = (info: MP4Info): ParsedMP4Metadata => ({
  durationSeconds: info.duration / info.timescale,
  videoCodecs: info.videoTracks.map(({ codec }) => codec.toLowerCase()),
  audioCodecs: info.audioTracks.map(({ codec }) => codec.toLowerCase()),
})
```

Reject missing video tracks, non-finite duration, parser errors, and buffers that never produce `onReady`. Keep the adapter in `parseMP4Metadata.ts`; do not expose `mp4box` types to collection configuration.

- [ ] **Step 5: Implement configured video-policy evaluation**

Check duration, require at least one H.264 track, and allow no audio track or only configured audio codec prefixes. Return precise error strings for each condition.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run the command from Step 3. Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/collections/parseMP4Metadata.ts src/collections/mediaUploadPolicy.ts tests/int/media-upload-policy.int.spec.ts
git commit -m "feat: validate media video metadata"
```

---

### Task 3: Apply original-only upload behavior in Payload

**Files:**
- Modify: `src/collections/Media.ts`
- Modify: `src/collections/mediaUploadPolicy.ts`
- Create: `tests/int/media-collection.int.spec.ts`

**Interfaces:**
- Produces: `validateMediaUpload({ data, req }): Promise<void>` used as a collection `beforeValidate` hook.
- Consumes: Task 1 image validation, Task 2 MP4 parsing and video validation, Payload `req.file`.

- [ ] **Step 1: Write failing collection tests**

Assert that `Media.upload` has no `imageSizes`, `resizeOptions`, or string thumbnail name; `focalPoint` and `crop` are false; the Admin thumbnail callback returns `doc.url`; and a `beforeValidate` hook is registered.

Test hook behavior with Payload-style arguments:

```ts
await expect(hook({
  data: { width: 1600, height: 1200, mimeType: 'image/jpeg' },
  operation: 'create',
  req: { file: { mimetype: 'image/jpeg', size: 20, data: Buffer.from('image') } },
} as never)).resolves.toBeDefined()

await expect(hook({
  data: { alt: 'Updated only' },
  operation: 'update',
  req: { file: undefined },
} as never)).resolves.toBeDefined()
```

Add rejection cases for invalid image ratio, oversized MP4 before parsing, and non-MP4 video MIME.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-collection.int.spec.ts`

Expected: FAIL because Media still defines generated sizes and has no validation hook.

- [ ] **Step 3: Implement the upload hook**

The hook returns incoming data unchanged when `req.file` is absent. For raster images it validates `data.width` and `data.height`. For video it checks MIME and bytes first, reads `req.file.tempFilePath` with `node:fs/promises` when Payload uses temp files, otherwise reads `req.file.data`, then parses and validates MP4 metadata. Throw `APIError(message, 400)` on rejection.

- [ ] **Step 4: Simplify Media upload configuration**

Replace generated sizes with original-only settings:

```ts
upload: {
  adminThumbnail: ({ doc }) => doc.url || undefined,
  crop: false,
  focalPoint: false,
},
hooks: {
  beforeValidate: [validateMediaUpload],
},
```

Do not set `resizeOptions`, `formatOptions`, or `imageSizes`.

- [ ] **Step 5: Run focused and existing upload tests**

Run:

```bash
corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-collection.int.spec.ts tests/int/brand-assets.int.spec.ts tests/int/social-platform-db.int.spec.ts
```

Expected: PASS, including unchanged `brand-assets` behavior.

- [ ] **Step 6: Commit**

```bash
git add src/collections/Media.ts src/collections/mediaUploadPolicy.ts tests/int/media-collection.int.spec.ts
git commit -m "feat: store original media uploads only"
```

---

### Task 4: Provider-neutral presentation config and Cloudflare adapter

**Files:**
- Create: `src/components/Media/config.ts`
- Create: `src/components/Media/cloudflare.ts`
- Modify: `src/components/Media/types.ts`
- Create: `tests/int/media-cloudflare.int.spec.ts`

**Interfaces:**
- Produces: `MediaPresentation`, `ImagePresentation`, `VideoPresentation`, `MEDIA_PRESENTATION`, `buildCloudflareImageURL(args): string`, `buildCloudflareVideoURL(args): string`.
- Consumes: original absolute URL, requested output width, optional quality, and provider-neutral presentation intent.

- [ ] **Step 1: Write failing URL-contract tests**

Cover deterministic option order, same-origin image pathname, encoded spaces, version query preservation, full video source URL, original URL fallback, and configuration presets:

```ts
expect(buildCloudflareImageURL({
  source: 'https://media-dev.ecolitea.com/photos/card image.jpg?version=7',
  width: 640,
  presentation: MEDIA_PRESENTATION.card,
})).toBe(
  'https://media-dev.ecolitea.com/cdn-cgi/image/width=640,height=480,fit=cover,quality=85,format=auto/photos/card%20image.jpg?version=7',
)
```

Use a card preset with ratio `4:3`, fit `cover`, quality `85`; body media preserves ratio with `scale-down`; hero preserves ratio at the Cloudflare layer and retains CSS cover behavior.

- [ ] **Step 2: Run the adapter test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-cloudflare.int.spec.ts`

Expected: FAIL because the config, types, and adapter do not exist.

- [ ] **Step 3: Add provider-neutral types and typed presets**

Use this public contract:

```ts
export type AspectRatio = { width: number; height: number }
export type MediaFit = 'cover' | 'contain' | 'scale-down'
export type ImagePresentation = {
  aspectRatio?: AspectRatio
  fit?: MediaFit
  quality?: number
}
export type VideoPresentation = {
  width?: number
  height?: number
  fit?: MediaFit
}
export type MediaPresentation = {
  image?: ImagePresentation
  video?: VideoPresentation
}
```

`Props` gains `presentation?: MediaPresentation`; existing `size?: string` remains the HTML `sizes` property.

- [ ] **Step 4: Implement the Cloudflare adapter**

Build options from typed inputs. For image URLs use `sourceURL.origin`, `sourceURL.pathname`, and `sourceURL.search`; calculate `height = round(width * ratio.height / ratio.width)` only when an aspect ratio exists. Clamp image quality to `1..100`. For video URLs use the full encoded source URL required by `/cdn-cgi/media/`.

Return the original source when it is relative, invalid, already under `/cdn-cgi/`, or has a non-HTTP protocol. Keep Cloudflare option names private to this module.

- [ ] **Step 5: Run the adapter test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Media/config.ts src/components/Media/cloudflare.ts src/components/Media/types.ts tests/int/media-cloudflare.int.spec.ts
git commit -m "feat: add media delivery adapter"
```

---

### Task 5: Connect the shared Media renderer

**Files:**
- Modify: `src/components/Media/index.tsx`
- Modify: `src/components/Media/ImageMedia/index.tsx`
- Modify: `src/components/Media/VideoMedia/index.tsx`
- Create: `tests/int/media-renderer.int.spec.tsx`

**Interfaces:**
- Produces: public `<Media presentation={...} size={...} resource={...} />` behavior.
- Consumes: Task 4 provider-neutral props, presets, and Cloudflare adapter.

- [ ] **Step 1: Write failing renderer tests**

Mock `next/image` as a component that invokes its loader. Assert that a Payload raster resource produces a Cloudflare image URL, a local `StaticImageData` source stays local, a video uses the stored `resource.url`, and a PDF returns no image/video transformation.

Include a regression proving `VideoMedia` no longer reconstructs `/media/${filename}`:

```ts
const resource = media({
  filename: 'clip.mp4',
  mimeType: 'video/mp4',
  url: 'https://media-dev.ecolitea.com/uploads/clip.mp4',
})
```

Expected video source begins with `https://media-dev.ecolitea.com/cdn-cgi/media/` and contains the stored URL as its source.

- [ ] **Step 2: Run the renderer test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-renderer.int.spec.tsx`

Expected: FAIL because the renderer still routes images through Next's default optimizer and reconstructs video URLs.

- [ ] **Step 3: Implement image loader integration**

For populated Payload image resources, pass a loader closure that calls `buildCloudflareImageURL({ source: src, width, quality, presentation: presentation?.image })`. Keep intrinsic width and height for layout stability and keep `sizes` for responsive `srcset`. Remove the obsolete explanatory comment describing Next server optimization.

For static imports, omit the Cloudflare loader. Do not transform `brand-assets`, which never enter this component.

- [ ] **Step 4: Implement MIME dispatch and video integration**

Make the shared `Media` dispatch explicit: image resources render `ImageMedia`, video resources render `VideoMedia`, and unsupported/document resources do not get transformed by these visual components. `VideoMedia` uses `resource.url` plus its cache tag and calls `buildCloudflareVideoURL`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-cloudflare.int.spec.ts tests/int/media-renderer.int.spec.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Media tests/int/media-renderer.int.spec.tsx
git commit -m "feat: render media through Cloudflare"
```

---

### Task 6: Declare presentation needs in existing consumers

**Files:**
- Modify: `src/components/Card/index.tsx`
- Modify: `src/blocks/MediaBlock/Component.tsx`
- Modify: `src/heros/HighImpact/index.tsx`
- Modify: `src/heros/MediumImpact/index.tsx`
- Modify: `src/heros/PostHero/index.tsx`
- Create: `tests/int/media-consumers.int.spec.tsx`
- Modify: `tests/int/logo.int.spec.tsx`

**Interfaces:**
- Produces: explicit consumer-to-preset mappings.
- Consumes: `MEDIA_PRESENTATION.card`, `.body`, and `.hero` from Task 4.

- [ ] **Step 1: Write failing consumer mapping tests**

Render or inspect the relevant React trees and assert:

- Card passes `MEDIA_PRESENTATION.card` and keeps `size="33vw"`;
- Media Block passes `MEDIA_PRESENTATION.body`;
- all three image Hero renderers pass `MEDIA_PRESENTATION.hero`;
- logo and favicon resolution still returns original cache-tagged URLs with no `/cdn-cgi/` segment;
- footer social icons still use original SVG URLs;
- `generateMeta` still returns the original SEO image URL.

- [ ] **Step 2: Run the consumer test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-consumers.int.spec.tsx tests/int/logo.int.spec.tsx`

Expected: new mapping assertions fail because consumers do not pass presets.

- [ ] **Step 3: Apply named presets in frontend renderers**

Import `MEDIA_PRESENTATION` from `@/components/Media/config` and pass the relevant preset. Do not change Payload Block configs, upload relationship fields, or stored Block data.

Keep existing CSS classes. The hero preset does not request Cloudflare crop, so current browser `object-cover` behavior and visual composition remain stable.

- [ ] **Step 4: Run consumer and regression tests**

Run:

```bash
corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-consumers.int.spec.tsx tests/int/logo.int.spec.tsx tests/int/header-component.int.spec.tsx tests/int/footer-component.int.spec.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Card/index.tsx src/blocks/MediaBlock/Component.tsx src/heros tests/int/media-consumers.int.spec.tsx tests/int/logo.int.spec.tsx
git commit -m "feat: declare media presentation presets"
```

---

### Task 7: Regenerate types and add guarded development cleanup

**Files:**
- Modify: `src/payload-types.ts`
- Create: `scripts/cleanup-development-media.ts`
- Modify: `package.json`
- Create: `tests/int/media-cleanup.int.spec.ts`

**Interfaces:**
- Produces: `pnpm cleanup:media -- --expected-origin=https://media-dev.ecolitea.com [--execute]`.
- Consumes: Payload local API and the configured `R2_PUBLIC_URL`.

- [ ] **Step 1: Write failing cleanup safety tests**

Extract and test pure argument/origin guards. The command must default to dry-run, refuse execution without an exact `--expected-origin`, refuse a mismatch with normalized `R2_PUBLIC_URL`, target only collection `media`, and never query or delete `brand-assets`.

Test inventory output includes Media ID, original URL, known legacy `sizes` filenames, and references discovered in Pages, Posts, and Case Studies.

- [ ] **Step 2: Run cleanup tests and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-cleanup.int.spec.ts`

Expected: FAIL because the cleanup module and package script do not exist.

- [ ] **Step 3: Implement guarded dry-run and execution modes**

Use `getPayload({ config })`, normalize both origins with `new URL(value).origin`, inventory documents and references first, and print stable JSON. With `--execute`, abort without mutation when any Page, Post, or Case Study still references a target Media ID. After the development content has been cleared or re-seeded and a fresh inventory has no references, delete with:

```ts
await payload.delete({
  collection: 'media',
  where: { id: { in: mediaIDs } },
  context: { disableRevalidate: true },
})
```

Delete through Payload so `@payloadcms/storage-s3` owns R2 deletion. The script must abort before mutation if reference cleanup cannot be completed. Add:

```json
"cleanup:media": "cross-env NODE_OPTIONS=--no-deprecation tsx scripts/cleanup-development-media.ts"
```

- [ ] **Step 4: Regenerate Payload types**

Run: `corepack pnpm generate:types`

Expected: `Media.sizes` and focal-point fields generated solely by the removed configuration disappear; unrelated generated types remain stable.

- [ ] **Step 5: Run cleanup dry-run only**

Run: `corepack pnpm cleanup:media -- --expected-origin=https://media-dev.ecolitea.com`

Expected: exits successfully after printing targets and references; no database or R2 mutation occurs.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-cleanup.int.spec.ts tests/int/media-collection.int.spec.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json scripts/cleanup-development-media.ts src/payload-types.ts tests/int/media-cleanup.int.spec.ts
git commit -m "chore: add development media cleanup"
```

Do not execute destructive cleanup as part of implementation verification. The dry-run inventory is the review artifact for a later explicit execution.

---

### Task 8: Full verification and documentation alignment

**Files:**
- Modify: `README.md`
- Modify: `.env.example` only if its existing `R2_PUBLIC_URL` comment needs clarification; do not add another URL variable.
- Create: `tests/int/media-documentation.int.spec.ts`

**Interfaces:**
- Produces: documented development delivery flow and a verified branch.
- Consumes: all previous tasks.

- [ ] **Step 1: Add a failing documentation assertion**

Create `tests/int/media-documentation.int.spec.ts` to require README text describing original-only R2 storage, render-time Transformations, direct `brand-assets` delivery, and the single `R2_PUBLIC_URL` source of origin.

- [ ] **Step 2: Run the documentation test and verify RED**

Run: `corepack pnpm vitest run --config ./vitest.config.mts tests/int/media-documentation.int.spec.ts`

Expected: FAIL because README still describes only generic R2 storage.

- [ ] **Step 3: Update README**

Document the three delivery paths, Admin original URL behavior, configured upload limits, and development Transformation prerequisite. Keep production rollout out of the instructions.

- [ ] **Step 4: Run generated-type and static checks**

Run:

```bash
corepack pnpm generate:types
corepack pnpm lint
corepack pnpm build
```

Expected: all commands exit 0 without new warnings attributable to this change.

- [ ] **Step 5: Run the full integration suite**

Run: `corepack pnpm test:int`

Expected: all tests pass.

- [ ] **Step 6: Run targeted browser coverage**

Run: `corepack pnpm test:e2e -- tests/e2e/frontend.e2e.spec.ts tests/e2e/website-shell.e2e.spec.ts`

Expected: public pages render images without requests to `/_next/image` for Payload Media, transformed image requests use `media-dev.ecolitea.com/cdn-cgi/image/`, and Header/Footer brand assets remain original URLs.

- [ ] **Step 7: Inspect the final diff**

Run:

```bash
git status --short
git diff --check
git diff --stat chore/site-settings-and-site-shell...HEAD
```

Expected: only planned source, tests, generated types, dependency metadata, README, spec, and plan changes are present; `.claude/` remains untracked and excluded.

- [ ] **Step 8: Commit final documentation and verification changes**

```bash
git add README.md tests/int/media-documentation.int.spec.ts
git commit -m "docs: document media delivery pipeline"
```

If `.env.example` changed, add that exact path to the staging command. Confirm `git diff --cached --check` before committing.
