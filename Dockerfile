FROM node:24.15.0-alpine AS base
ENV PNPM_HOME=/pnpm PATH=$PNPM_HOME:$PATH NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
FROM deps AS builder
COPY . .
ENV NODE_ENV=production PAYLOAD_SECRET=build-only-payload-secret-32-characters-long DATABASE_URI=mongodb://localhost:27017/build R2_BUCKET=build-only R2_ACCESS_KEY_ID=build-only R2_SECRET_ACCESS_KEY=build-only R2_ENDPOINT=https://example.invalid R2_PUBLIC_URL=https://example.invalid NEXT_PUBLIC_SERVER_URL=http://localhost:3000 CRON_SECRET=build-only PREVIEW_SECRET=build-only
RUN pnpm build
FROM node:24.15.0-alpine AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
RUN addgroup -S ecolitea && adduser -S ecolitea -G ecolitea
COPY --from=builder --chown=ecolitea:ecolitea /app/.next/standalone ./
COPY --from=builder --chown=ecolitea:ecolitea /app/.next/static ./.next/static
COPY --from=builder --chown=ecolitea:ecolitea /app/public ./public
USER ecolitea
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=5 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
