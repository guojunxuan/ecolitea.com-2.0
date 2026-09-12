# Ecolitea 2.0

Ecolitea 2.0 is a self-hosted website and content-management application. Next.js serves the
public website and Payload Admin from one application, MongoDB stores content, and Cloudflare
R2 stores uploaded media.

## Technology stack

- Next.js 16 and React 19
- Payload CMS 4
- TypeScript and Tailwind CSS
- MongoDB 7
- Cloudflare R2 media storage
- Docker Compose and Caddy for production
- pnpm 9.15.4

## Local development

### Requirements

- Node.js 24.20.0 or another release matching `package.json`
- Corepack with pnpm 9.15.4
- A running MongoDB instance

Install the locked dependencies and generate the Payload Admin import map:

```bash
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm generate:importmap
```

The existing local Docker MongoDB is exposed on port `27017`. Start the development server with:

```bash
DATABASE_URI=mongodb://127.0.0.1:27017/ecolitea2 corepack pnpm dev
```

- Website: `http://localhost:3000`
- Payload Admin: `http://localhost:3000/admin`

Keep the terminal running while developing. Press `Ctrl+C` to stop the service.

### Media delivery in development

Payload and the Admin UI keep and preview the uploaded original URL. R2 stores one original/master
object for each `media` upload; generated image sizes and Transformation URLs are not stored in
Payload or R2.

`R2_PUBLIC_URL` is the single public origin for those originals and for public render-time media
delivery. To use Transformations in development, configure that value with the approved development
origin, `https://media-dev.ecolitea.com`, and ensure the development custom domain supports the
Cloudflare Transformation paths before exercising public media rendering.

- Public raster Media uses `/cdn-cgi/image/` at render time. It does not use Next's `/_next/image`
  endpoint.
- A validated MP4 at most 60 seconds long uses `/cdn-cgi/media/` at render time. A longer video, or
  one with missing duration metadata, keeps its original URL.
- Documents use their direct original CDN URL. Brand Assets (logos, social icons, and favicons) also
  remain on their original URLs.

Media uploads accept raster images at `1:1`, `4:3`, `3:2`, `16:9`, `9:16`, or `4:5` (within 1%).
Video uploads must be MP4/H.264 with AAC or MP3 audio when present, no larger than 100 MB, and no
longer than 10 minutes.

## Common commands

```bash
corepack pnpm dev                 # Start the development server
corepack pnpm test:int            # Run integration tests
corepack pnpm test:e2e            # Run Playwright end-to-end tests
corepack pnpm exec tsc --noEmit   # Type-check the project
corepack pnpm lint                # Run ESLint
corepack pnpm build               # Create a production build
corepack pnpm start               # Start a completed production build
```

Integration and end-to-end tests require MongoDB. Playwright also requires its Chromium browser:

```bash
corepack pnpm exec playwright install chromium
```

## Environment configuration

Copy `.env.example` to `.env` and replace its placeholders. The main configuration groups are:

- Application: `DATABASE_URI`, `PAYLOAD_SECRET`, `NEXT_PUBLIC_SERVER_URL`
- Payload operations: `CRON_SECRET`, `PREVIEW_SECRET`
- R2 storage: `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_PUBLIC_URL`
- Public URLs and optional integrations: see `.env.example`

Never commit `.env`, database credentials, Payload secrets, or R2 access keys.

## Testing and CI

GitHub Actions starts a disposable MongoDB 7 service, installs locked dependencies, and runs
integration tests, Playwright tests, type checking, and the production build.

Validation jobs set `DISABLE_R2_STORAGE=true`, so test uploads use local temporary storage and
never contact production R2. Docker image builds and production runtime do not set this flag;
R2 remains enabled there.

The CI and release workflows are manually triggered with `workflow_dispatch`.

## Production architecture

```text
Visitor -> Cloudflare CDN/TLS -> Caddy -> Next.js + Payload
                                           |-> MongoDB
                                           `-> Cloudflare R2

GitHub Actions -> GHCR -> Docker Compose
```

Docker Compose runs the application, MongoDB, and Caddy. MongoDB data is stored in the
`mongodb_data` volume, while uploaded media remains in Cloudflare R2.

## Deployment

See [`docs/deployment.md`](docs/deployment.md) for initial server setup, releases, upgrades,
rollbacks, backups, recovery, and health checks.
