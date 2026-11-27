# Media and Documents upgrade checks

Payload owns the resource collections, validation hooks, references, Admin fields and file endpoints. Next.js hosts those APIs and Admin. Storage and Cloudflare delivery remain adapters; frontend components use the shared Media presentation model.

The verified dependency baseline is `payload` and every `@payloadcms/*` package at `4.0.0-canary.29`, Next.js `16.3.3`, React `19.2.6`, `react-image-crop` `10.1.8`, Playwright `1.59.1` and Payload’s transitive `file-type` `22.0.1`. `package.json` and `pnpm-lock.yaml` remain authoritative. Upgrade all Payload packages together and read the installed Next.js guides before changing build behavior.

| Integration | Contract to inspect after upgrading | Focused checks |
| --- | --- | --- |
| `upload.admin.components.controls` | Public slot resolves through the generated import map. Native controls unmount after file selection; the project-owned `imageCrop` UI field keeps the crop dialog mounted. | `media-crop.int.spec.tsx`, browser automatic crop/save |
| `useUploadEdits` | Public percent crop, `widthInPixels` and `heightInPixels` reach sharp before server aspect validation; native focal edits remain available. | `media-crop-upload.int.spec.ts`, `media-cloudflare.int.spec.ts`, browser crop/focus |
| `admin.components.Cell` | Native `width` selects `height`; sizes use `payload/shared` `formatFilesize`. | `media-admin.int.spec.tsx`, `documents-admin.int.spec.tsx` |
| `upload.adminThumbnail` | Both collection configs return same-origin authenticated `/:id/file` URLs. **Payload's native toolbar currently chooses `thumbnailURL ?? url` for open/download links. This selection is an internal behavior dependency.** | `media-download.int.spec.ts`, `documents-download.int.spec.ts`, browser native download event with unchanged page URL |
| Standalone file reader | `file-type` 22 dynamically imports Node modules. The installed `withPayload` transitive `serverExternalPackages` entry is ineffective with pnpm root resolution. Externalize the root `payload` package through Next’s public `serverExternalPackages` so its dependencies are traced. Keep the API-scoped, project-relative `strtok3` JS tracing include: `file-type` dynamically imports its filesystem entry, which NFT otherwise omits. A narrow webpack `file-type` external was rejected: a clean standalone runtime could not resolve it. | `media-build-config.int.spec.ts`, browser build with `NODE_PATH` cleared, actual original/download bytes |
| Native preview | Images follow authenticated image redirects. PDF uses Payload's native iframe; Office uses its native file icon/metadata, without an Office rendering service. | Browser PDF/Office upload, preview and original-file actions |
| Native upload form | Each single/batch form exposes its selected File to the independent alt/title prefill fields. Existing editor text remains intact. | `media-admin.int.spec.tsx`, `documents-admin.int.spec.tsx`, browser single/batch prefill |
| Native reference data | Exact `payload-locked-documents` and `payload-preferences` records are operational editor state. Hidden application content still counts. | `media-references.int.spec.ts`, `documents-references.int.spec.ts`, browser Used in/delete protection |
| Native folders | Both resources share `_h_folders`; deleting parent/child folders unfiles resources and does not revalidate unchanged legacy text. | `media-folders.int.spec.ts`, `documents-folders.int.spec.ts`, browser move/delete |
| S3 `prefix` / object key | Installed upload/delete hooks and `generateR2FileURL` agree on explicit, empty and absent prefixes. Original URLs stay persisted; delivery URLs are derived. | `site-assets.int.spec.ts`, `resource-prefix-migration.int.spec.ts` (in-memory SDK mock, no remote service) |

Run the focused browser suite with local MongoDB available:

```bash
DISABLE_R2_STORAGE=true corepack pnpm test:e2e tests/e2e/media-documents.e2e.spec.ts --project=chromium
```

Playwright derives a unique `*-e2e` database from `E2E_DATABASE_URI` (default `mongodb://127.0.0.1:27017/ecolitea2-e2e`), prints the resolved target before seeding, binds the application URL to the test origin, builds the standalone application with `NODE_PATH` cleared and stores unique run-prefixed uploads locally. It never reuses a developer server. Set `DISABLE_R2_STORAGE=true`; do not supply production credentials or endpoints. The browser suite checks local originals and adapters, not live Cloudflare decoding.

Run the integration files named above with the dedicated local base and regenerate artifacts:

```bash
DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2-test DISABLE_R2_STORAGE=true corepack pnpm test:int tests/int/media-build-config.int.spec.ts tests/int/media-crop.int.spec.tsx tests/int/media-crop-upload.int.spec.ts tests/int/media-cloudflare.int.spec.ts tests/int/media-admin.int.spec.tsx tests/int/documents-admin.int.spec.tsx tests/int/media-download.int.spec.ts tests/int/documents-download.int.spec.ts tests/int/media-references.int.spec.ts tests/int/documents-references.int.spec.ts tests/int/media-folders.int.spec.ts tests/int/documents-folders.int.spec.ts tests/int/site-assets.int.spec.ts tests/int/resource-prefix-migration.int.spec.ts
DISABLE_R2_STORAGE=true corepack pnpm generate:types
DISABLE_R2_STORAGE=true corepack pnpm generate:importmap
corepack pnpm exec tsc --noEmit --incremental false
corepack pnpm lint
```

The File public API does not distinguish local selection from a fetched URL upload. Either may offer image cropping; a direct API upload with invalid dimensions still rejects. Do not add private DOM heuristics to distinguish sources.

These checks do not migrate existing storage keys, delete missing records or purge Media versions. Follow the separate resource-prefix runbook, report the exact database/bucket/domain, and obtain the required confirmations before any real environment mutation.
