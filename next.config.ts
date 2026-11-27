import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
const dirname = path.dirname(fileURLToPath(import.meta.url))
import { redirects } from './redirects'
import { serverEnv } from './src/utilities/env'

const NEXT_PUBLIC_SERVER_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : process.env.__NEXT_PRIVATE_ORIGIN || 'http://localhost:3000'

const nextConfig: NextConfig = {
  // Extra local hostnames (comma-separated) for dev-only features bound to a domain, e.g. Turnstile.
  allowedDevOrigins: [
    '127.0.0.1',
    ...(process.env.NEXT_DEV_ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
  // Keep browser-test builds separate from a developer's active `.next` output.
  distDir: process.env.PLAYWRIGHT_TEST === 'true' ? '.next-e2e' : '.next',
  output: 'standalone',
  images: {
    localPatterns: [
      {
        pathname: '/api/media/file/**',
      },
    ],
    qualities: [100],
    remotePatterns: [
      ...[NEXT_PUBLIC_SERVER_URL, serverEnv.R2_PUBLIC_URL].map((item) => {
        const url = new URL(item)

        return {
          hostname: url.hostname,
          protocol: url.protocol.replace(':', '') as 'http' | 'https',
        }
      }),
    ],
  },
  // Payload's file-type dependency uses dynamic Node imports. Externalize the
  // root package so standalone tracing includes its transitive runtime modules
  // without relying on pnpm's NODE_PATH or a project-root file-type install.
  serverExternalPackages: ['payload'],
  // file-type loads strtok3's filesystem entry through a non-literal import,
  // which NFT cannot infer from its statically traced core entry.
  outputFileTracingIncludes: {
    '/api/*': ['./node_modules/.pnpm/strtok3@*/node_modules/strtok3/lib/**/*.js'],
  },
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    return webpackConfig
  },
  reactStrictMode: true,
  headers: () => [
    {
      source: '/fonts/product-code/:font*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: '*' },
        { key: 'Access-Control-Allow-Methods', value: 'GET, HEAD' },
      ],
    },
  ],
  redirects,
  turbopack: {
    root: path.resolve(dirname),
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
