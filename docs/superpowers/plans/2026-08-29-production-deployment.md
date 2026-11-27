# Production Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ecolitea deployable as one Next.js/Payload container backed by MongoDB 7 and Cloudflare R2, with reproducible manual CI and GHCR releases.

**Architecture:** Payload remains embedded in the Next.js App Router process. Docker Compose owns a persistent MongoDB 7 service and a versioned GHCR application service; Payload's official S3 adapter writes media to R2 and returns public CDN URLs.

**Tech Stack:** Next.js 16, React 19, Payload CMS, TypeScript, MongoDB 7, Cloudflare R2, Docker Compose, Caddy, GitHub Actions, GHCR

**Spec:** `docs/specs/production-deployment.md`

## Global Constraints

- Before each Payload-related implementation task, read the relevant official `https://github.com/payloadcms/payload/tree/main/docs` section and cite the chosen API in the task notes.
- Treat `main` documentation as the primary reference, but verify every copied API against the installed published Payload version's types/source and the project's TypeScript/tests.
- Runtime application and Payload admin must remain in one container on port 3000.
- Payload must consume `DATABASE_URI`; Compose must map `MONGODB_URI` to it.
- MongoDB must use `mongo:7.0` and a persistent named volume.
- Media must use `@payloadcms/storage-s3` with R2's S3 API; do not use the Workers-only R2 binding adapter.
- Production credentials must never be baked into Docker image layers.
- The host may expose only `127.0.0.1:3000`; MongoDB must remain internal.
- Application releases must not recreate MongoDB or delete its volume.
- The running `ecolitea-mongodb-2` container and its data are user-owned. Only inspect it read-only until its network, volume, authentication, and intended Compose ownership are known.

---

### Task 1: Make dependency installation reproducible

**Files:**
- Modify: `package.json`
- Create: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: the current Payload template dependency list
- Produces: installable, exact compatible Payload packages including `@payloadcms/storage-s3`

- [ ] **Step 1: Replace every Payload `workspace:*` dependency with one identical published Payload version and add `@payloadcms/storage-s3` at that version.**

  Keep `payload`, every `@payloadcms/*` package, and the storage adapter on exactly the same version to prevent peer/type skew.

  Before editing, read `main/docs/getting-started/installation.mdx`, the package manifests under `packages/`, and the release notes for the chosen published version. Do not assume that `main` package versions are already published.

- [ ] **Step 2: Align the declared Node engine, Docker base image, and Actions runtime on Node 24.**

  Use `"node": ">=24.15.0"` and pin a Node 24 Alpine image by patch version during implementation.

- [ ] **Step 3: Install and create the lockfile.**

  Run: `corepack pnpm install`

  Expected: installation succeeds without workspace resolution errors and creates `pnpm-lock.yaml`.

- [ ] **Step 4: Verify the dependency graph.**

  Run: `corepack pnpm list payload @payloadcms/db-mongodb @payloadcms/storage-s3`

  Expected: all Payload packages resolve to the same published version.

- [ ] **Step 5: Commit.**

  Run: `git add package.json pnpm-lock.yaml && git commit -m "build: pin Payload dependencies"`

### Task 2: Normalize and validate runtime configuration

**Files:**
- Modify: `.env.example`
- Modify: `src/environment.d.ts`
- Create: `src/utilities/env.ts`
- Create: `tests/int/env.int.spec.ts`

**Interfaces:**
- Consumes: process environment variables
- Produces: `serverEnv` containing `DATABASE_URI`, Payload secrets, site URL, and R2 credentials

- [ ] **Step 1: Write failing tests for missing variables and trailing-slash normalization.**

```ts
import { describe, expect, it } from 'vitest'
import { parseServerEnv } from '@/utilities/env'

it('requires DATABASE_URI', () => {
  expect(() => parseServerEnv({ PAYLOAD_SECRET: 'x'.repeat(32) })).toThrow('DATABASE_URI')
})

it('removes the trailing slash from R2_PUBLIC_URL', () => {
  const env = parseServerEnv(validEnv({ R2_PUBLIC_URL: 'https://media.example.com/' }))
  expect(env.R2_PUBLIC_URL).toBe('https://media.example.com')
})
```

- [ ] **Step 2: Run the test and confirm it fails because `parseServerEnv` does not exist.**

  Run: `corepack pnpm test:int -- env.int.spec.ts`

- [ ] **Step 3: Implement `parseServerEnv(env: NodeJS.ProcessEnv)` with explicit errors for all required server values.**

  Required keys: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`, `CRON_SECRET`, `PREVIEW_SECRET`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`.

- [ ] **Step 4: Document safe placeholders in `.env.example`; document `MONGODB_URI` and `IMAGE_TAG` as Compose-only variables.**

- [ ] **Step 5: Run the focused test and TypeScript check.**

  Run: `corepack pnpm test:int -- env.int.spec.ts` and `corepack pnpm exec tsc --noEmit --incremental false`

- [ ] **Step 6: Commit.**

  Run: `git add .env.example src/environment.d.ts src/utilities/env.ts tests/int/env.int.spec.ts && git commit -m "config: define production environment contract"`

### Task 3: Connect Payload to MongoDB and R2

**Files:**
- Modify: `src/payload.config.ts`
- Modify: `src/plugins/index.ts`
- Modify: `src/collections/Media.ts`
- Modify: `src/utilities/getMediaUrl.ts`
- Modify: `next.config.ts`
- Test: `tests/int/api.int.spec.ts`
- Create: `tests/int/media-url.int.spec.ts`

**Interfaces:**
- Consumes: `serverEnv` from Task 2 and Payload's `Media` collection
- Produces: `mongooseAdapter({ url: serverEnv.DATABASE_URI })` and an `s3Storage` plugin for `media`

- [ ] **Step 1: Write failing URL tests.**

  Before editing, read `main/docs/database`, `main/docs/upload`, and the `main/packages/storage-s3` source and tests. Record the exact referenced files in the implementation notes.

```ts
expect(getMediaUrl('photo.webp', null, 'https://media.ecolitea.com')).toBe(
  'https://media.ecolitea.com/photo.webp',
)
expect(getMediaUrl('https://media.ecolitea.com/photo.webp', 'v1')).toBe(
  'https://media.ecolitea.com/photo.webp?v1',
)
```

- [ ] **Step 2: Configure the official adapter exactly for R2.**

```ts
s3Storage({
  collections: {
    media: {
      disablePayloadAccessControl: true,
      generateFileURL: ({ filename, prefix }) =>
        `${serverEnv.R2_PUBLIC_URL}/${prefix ? `${prefix}/` : ''}${filename}`,
    },
  },
  bucket: serverEnv.R2_BUCKET,
  config: {
    credentials: {
      accessKeyId: serverEnv.R2_ACCESS_KEY_ID,
      secretAccessKey: serverEnv.R2_SECRET_ACCESS_KEY,
    },
    endpoint: serverEnv.R2_ENDPOINT,
    forcePathStyle: true,
    region: 'auto',
  },
})
```

- [ ] **Step 3: Remove `staticDir` from `Media.upload`; retain focal point and all generated image sizes.**

- [ ] **Step 4: Allow only the parsed R2 public hostname plus the site hostname in Next Image `remotePatterns`.**

- [ ] **Step 5: Run media tests, API integration tests, and type-check.**

  Run: `corepack pnpm test:int` and `corepack pnpm exec tsc --noEmit --incremental false`

- [ ] **Step 6: Commit.**

  Run: `git add src next.config.ts tests/int && git commit -m "feat: store Payload media in Cloudflare R2"`

### Task 4: Add Case Studies with drafts and cache invalidation

**Files:**
- Create: `src/collections/CaseStudies/index.ts`
- Create: `src/collections/CaseStudies/hooks/revalidateCaseStudy.ts`
- Create: `src/app/(frontend)/case-studies/[slug]/page.tsx`
- Modify: `src/payload.config.ts`
- Modify: `src/payload-types.ts` via generator
- Modify: `src/app/(frontend)/next/preview/route.ts`
- Create: `tests/int/case-studies.int.spec.ts`

**Interfaces:**
- Consumes: existing access helpers, hero, layout blocks, preview path, and revalidation patterns
- Produces: collection slug `case-studies`, public route `/case-studies/:slug`, tag `case-studies`

- [ ] **Step 1: Write an integration test proving anonymous reads cannot return drafts and authenticated draft reads can.**

  Before editing, read `main/docs/versions`, `main/docs/access-control`, `main/docs/hooks`, and `main/docs/live-preview`.

- [ ] **Step 2: Implement the collection with `title`, `slug`, `hero`, `layout`, `publishedAt`, and SEO fields.**

  Configure `versions.drafts.autosave`, `schedulePublish: true`, and the same access policy as Pages and Posts.

- [ ] **Step 3: Implement hooks that invalidate `/case-studies/${slug}`, the prior slug when changed/unpublished, and the `case-studies` tag.**

- [ ] **Step 4: Add the frontend draft-aware detail route and preview routing.**

- [ ] **Step 5: Generate Payload types and run focused tests.**

  Run: `corepack pnpm generate:types`, `corepack pnpm test:int -- case-studies.int.spec.ts`, and `corepack pnpm exec tsc --noEmit --incremental false`.

- [ ] **Step 6: Commit.**

  Run: `git add src tests/int/case-studies.int.spec.ts && git commit -m "feat: add draftable case studies"`

### Task 5: Complete cache invalidation coverage

**Files:**
- Modify: `src/collections/Categories.ts`
- Create: `src/collections/hooks/revalidateCategories.ts`
- Modify: `src/collections/Pages/hooks/revalidatePage.ts`
- Modify: `src/collections/Posts/hooks/revalidatePost.ts`
- Modify: `src/Header/hooks/revalidateHeader.ts`
- Modify: `src/Footer/hooks/revalidateFooter.ts`
- Create: `tests/int/revalidation.int.spec.ts`

**Interfaces:**
- Consumes: Next.js `revalidatePath` and `revalidateTag`
- Produces: deterministic invalidation for collection detail/list routes, search, sitemaps, and globals

- [ ] **Step 1: Write hook tests with mocked Next cache functions for publish, unpublish, slug change, category change, and delete.**

  Before editing, read `main/docs/hooks` and inspect the current official website template's revalidation hooks.

- [ ] **Step 2: Make Posts invalidate the detail path, `/posts`, `/search`, `posts-sitemap`, and any shared post query tag.**

- [ ] **Step 3: Make Categories invalidate post listings/search and a `categories` tag.**

- [ ] **Step 4: Keep Pages and Case Studies symmetric for publish, unpublish, slug change, and delete.**

- [ ] **Step 5: Run revalidation tests and the full integration suite.**

  Run: `corepack pnpm test:int -- revalidation.int.spec.ts` then `corepack pnpm test:int`.

- [ ] **Step 6: Commit.**

  Run: `git add src tests/int/revalidation.int.spec.ts && git commit -m "fix: complete content cache invalidation"`

### Task 6: Build a production image and safe Compose stack

**Files:**
- Modify: `next.config.ts`
- Replace: `Dockerfile`
- Create: `.dockerignore`
- Replace: `docker-compose.yml`
- Create: `deploy/Caddyfile.example`
- Create: `tests/deploy/compose.test.mjs`

**Interfaces:**
- Consumes: immutable app image tag `${IMAGE_TAG}` and server `.env`
- Produces: services `ecolitea` and `mongodb`, named volume `mongodb_data`, host binding `127.0.0.1:3000`

- [ ] **Step 1: Write a deployment test that parses rendered Compose output and asserts MongoDB 7, internal DB networking, the URI mapping, health dependency, and loopback-only app port.**

  Before editing, read `main/docs/production/deployment.mdx` and `main/docs/production/building-without-a-db-connection.mdx`.

- [ ] **Step 2: Read-only inspect the running MongoDB container before defining ownership.**

  Run: `docker inspect ecolitea-mongodb-2`.

  Record its exact image tag, health status, Compose project/service labels, attached networks, bind mounts/named volumes, authentication variables (names only, never print secret values), and restart policy. Decide explicitly whether the new Compose file should adopt the existing volume/service or require a one-time operator migration.

- [ ] **Step 3: Enable `output: 'standalone'` and implement a Node 24 multi-stage Dockerfile using the frozen pnpm lockfile.**

  The runner must execute as a non-root user and define an HTTP healthcheck against `/api/health`.

- [ ] **Step 4: Implement Compose service contracts.**

```yaml
services:
  ecolitea:
    image: ghcr.io/${GHCR_REPOSITORY}:${IMAGE_TAG}
    ports: ['127.0.0.1:3000:3000']
    environment:
      DATABASE_URI: ${MONGODB_URI}
    depends_on:
      mongodb:
        condition: service_healthy
    restart: unless-stopped
  mongodb:
    image: mongo:7.0
    volumes: [mongodb_data:/data/db]
    restart: unless-stopped
```

- [ ] **Step 5: Add MongoDB and application healthchecks without publishing port 27017.**

- [ ] **Step 6: Add a Caddy example that reverse-proxies the public hostname to `127.0.0.1:3000`.**

- [ ] **Step 7: Render and test configuration, then build the image.**

  Run: `docker compose --env-file .env.example config`, `node --test tests/deploy/compose.test.mjs`, and `docker build -t ecolitea:local .`.

- [ ] **Step 8: Commit.**

  Run: `git add next.config.ts Dockerfile .dockerignore docker-compose.yml deploy tests/deploy && git commit -m "build: add production container stack"`

### Task 7: Replace CI and release workflows with project-accurate checks

**Files:**
- Replace: `.github/workflows/ci.yml`
- Replace: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: package scripts and Dockerfile from prior tasks
- Produces: manual validation workflow and main-only GHCR release workflow

- [ ] **Step 1: Remove references to nonexistent `test/*.test.*` and `build:skipDocs` scripts.**

- [ ] **Step 2: Configure CI with Node 24, pnpm from `packageManager`, `mongo:7.0`, dependency caching, `pnpm test:int`, Playwright Chromium installation, `pnpm test:e2e`, `tsc --noEmit`, and `pnpm build`.**

- [ ] **Step 3: Make test-only R2 config syntactically valid while preventing tests from writing to production R2.**

- [ ] **Step 4: Make Release accept `vMAJOR.MINOR.PATCH`, reject non-main/tag collisions, repeat all checks, then build once and push these tags:**

```text
ghcr.io/<owner>/<repo>:vMAJOR.MINOR.PATCH
ghcr.io/<owner>/<repo>:sha-<7-char-sha>
ghcr.io/<owner>/<repo>:latest
```

- [ ] **Step 5: Create the annotated Git tag and GitHub Release only after validation and image publication succeed.**

- [ ] **Step 6: Validate workflow YAML and action expressions locally.**

  Run: `corepack pnpm exec prettier --check .github/workflows/*.yml` and, when available, `actionlint .github/workflows/*.yml`.

- [ ] **Step 7: Commit.**

  Run: `git add .github/workflows && git commit -m "ci: validate and publish Ecolitea images"`

### Task 8: Document operations and perform release-grade verification

**Files:**
- Replace: `README.md`
- Create: `docs/deployment.md`

**Interfaces:**
- Consumes: all configuration and workflow contracts above
- Produces: operator runbook for initial deployment, upgrade, rollback, backup, and health verification

- [ ] **Step 1: Document R2 bucket creation, API credentials, public custom domain, CORS expectations, and all environment variables without real secrets.**

- [ ] **Step 2: Document initial server startup and application-only release commands.**

```bash
docker compose pull ecolitea
docker compose up -d --no-deps ecolitea
docker compose ps
docker compose logs --tail=100 ecolitea
```

- [ ] **Step 3: Document rollback by restoring the previous `IMAGE_TAG` and repeating the same two application-only Compose commands.**

- [ ] **Step 4: Document MongoDB backup/restore separately and state that releases never remove `mongodb_data`.**

- [ ] **Step 5: Run the full verification matrix.**

  Run: `corepack pnpm lint`, `corepack pnpm test:int`, `corepack pnpm test:e2e`, `corepack pnpm exec tsc --noEmit --incremental false`, `corepack pnpm build`, `docker compose config`, and `docker build -t ecolitea:verify .`.

- [ ] **Step 6: Inspect the built container as a non-root process and verify `/`, `/admin`, REST API, GraphQL, and health endpoints against MongoDB 7.**

- [ ] **Step 7: Commit.**

  Run: `git add README.md docs && git commit -m "docs: add production operations runbook"`
