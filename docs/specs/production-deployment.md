# Ecolitea Production Deployment Specification

## Documentation policy

- Before changing any Payload configuration or Payload-dependent code, read the relevant material in the official [`payloadcms/payload` `main` documentation](https://github.com/payloadcms/payload/tree/main/docs).
- Use `main` documentation as the primary design reference.
- Before committing an implementation, confirm that the selected published Payload package version exposes the documented API through its types or same-version source, then prove compatibility with TypeScript and tests.
- If `main` documentation and the installed release differ, do not silently copy the newer API: record the difference and use the compatible implementation.

## Runtime architecture

- Editors use Payload at `/admin`.
- Next.js and Payload run in one production container and listen on port 3000.
- Payload stores content and media metadata in MongoDB 7.
- Payload uploads original media and generated image sizes to Cloudflare R2.
- Cloudflare provides DNS, CDN, and edge TLS.
- Host Caddy proxies the origin to `127.0.0.1:3000`.

## Configuration contract

- Payload reads MongoDB through `DATABASE_URI`.
- Docker Compose receives `MONGODB_URI` and passes it to the application as `DATABASE_URI`.
- R2 uses `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, and `R2_PUBLIC_URL`.
- The app is exposed only as `127.0.0.1:3000:3000`; MongoDB is not published on the host.
- Production secrets stay in the server `.env`, never in an image or repository.

## Content and cache behavior

- Pages, Posts, Categories, Header, and Footer invalidate affected paths or cache tags after changes.
- Pages, Posts, and Case Studies support drafts and scheduled publication.
- Public queries return published documents; authenticated preview mode can return drafts.
- Media metadata lives in MongoDB, while originals and generated image sizes live in R2.
- Public media URLs use `R2_PUBLIC_URL`.

## Delivery workflow

1. CI is manually dispatched on a development branch, starts MongoDB 7, then runs integration tests, E2E tests, TypeScript checking, and a production build.
2. Release is manually dispatched from `main`, repeats validation, and builds a Docker image.
3. A successful release creates a Git tag, pushes version, commit-SHA, and `latest` tags to GHCR, and creates a GitHub Release.
4. The server operator changes `IMAGE_TAG` in `.env`, then runs `docker compose pull ecolitea` and `docker compose up -d --no-deps ecolitea`.
5. The application waits for the MongoDB healthcheck. MongoDB and its named volume are not recreated during an application-only release.

## Operational safety

- MongoDB uses a named persistent volume and `mongo:7.0` rather than `latest`.
- The app and MongoDB have healthchecks and restart policies.
- Seeding remains explicitly manual and destructive.
- No deployment command automatically deletes or migrates production data.
- A MongoDB container named `ecolitea-mongodb-2` is already running. Treat it and its data as user-owned; inspect it read-only before deciding whether the new Compose project adopts its network/volume or runs alongside it.
