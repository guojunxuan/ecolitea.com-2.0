# Production deployment

Copy `.env.example` to `.env` and set `GHCR_REPOSITORY`, `IMAGE_TAG`, `MONGODB_URI`, Payload secrets, and Cloudflare R2 credentials. Create an R2 bucket, S3 API token, and public custom domain; configure CORS for the site origin and media GET/HEAD.

Start the stack:

```sh
docker compose up -d mongodb ecolitea
docker compose ps
```

Upgrade or rollback by changing `IMAGE_TAG`, then:

```sh
docker compose pull ecolitea
docker compose up -d --no-deps ecolitea
```

Application releases never remove `mongodb_data` or recreate MongoDB. Back up with `mongodump --uri "$MONGODB_URI" --archive > backup.archive`; restore separately with `mongorestore --uri "$MONGODB_URI" --archive=backup.archive`.

Use Caddy with `deploy/Caddyfile.example` to proxy the public hostname to `127.0.0.1:3000`.
