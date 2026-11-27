import { withPayload } from '@payloadcms/next/withPayload'
import type { NextConfig } from 'next'
import path from 'path'
import { fileURLToPath } from 'url'
const dirname = path.dirname(fileURLToPath(import.meta.url))
import { redirects } from './redirects'

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
    // Remote media uses ImageMedia's custom loader; Admin brand images are unoptimized.
    // Keep deployment hosts out of the built-in optimizer's build-time configuration.
    remotePatterns: [],
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
