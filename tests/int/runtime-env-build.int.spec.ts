// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext, Script } from 'node:vm'
import { transformSync } from 'next/dist/build/swc'
import { inlineStaticEnv } from 'next/dist/lib/inline-static-env'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllEnvs())

const consumers = [
  'src/plugins/translation/revalidate.ts',
  'src/collections/Media.ts',
  'src/collections/Documents/index.ts',
  'src/collections/mediaEndpoints/file.ts',
  'src/collections/Documents/endpoints/file.ts',
]

const minify = (source: string): string =>
  transformSync(source, {
    jsc: {
      parser: { syntax: 'typescript' },
      target: 'es2022',
      minify: { compress: true, mangle: true },
    },
    module: { type: 'commonjs' },
    minify: true,
  }).code

describe('runtime public environment build boundary', () => {
  it('preserves runtime keys and consumer origins after Next minification and environment generation', async () => {
    const distDir = await mkdtemp(path.join(tmpdir(), 'runtime-env-build-'))
    try {
      const source = await readFile(new URL('../../src/utilities/env.ts', import.meta.url), 'utf8')
      const code = minify(source)
      await mkdir(path.join(distDir, 'server'))
      await mkdir(path.join(distDir, 'static'))
      const bundle = path.join(distDir, 'server', 'env.js')
      await writeFile(bundle, code)
      const consumerBundles = await Promise.all(
        consumers.map(async (consumer, index) => {
          const file = path.join(distDir, 'server', `consumer-${index}.js`)
          const source = await readFile(new URL(`../../${consumer}`, import.meta.url), 'utf8')
          await writeFile(file, minify(source))
          return { consumer, file }
        }),
      )
      // Exercise only these public settings, independent of a developer's local .env.
      for (const key of Object.keys(process.env)) {
        if (key.startsWith('NEXT_PUBLIC_')) vi.stubEnv(key, undefined)
      }
      vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'build-time-site-key')
      vi.stubEnv('NEXT_PUBLIC_SERVER_URL', 'https://build-origin.example.invalid')
      await inlineStaticEnv({
        distDir,
        config: { env: {}, deploymentId: 'test' } as Parameters<
          typeof inlineStaticEnv
        >[0]['config'],
      })

      for (const { consumer, file } of consumerBundles) {
        const generated = await readFile(file, 'utf8')
        expect(generated, consumer).not.toContain('https://build-origin.example.invalid')
        new Script(generated, { filename: consumer })
      }

      const exports = {} as {
        getConfiguredServerURL: () => string
        getTurnstileSiteKey: () => string | undefined
        serverEnv: { NEXT_PUBLIC_SERVER_URL: string }
      }
      const env = {
        NODE_ENV: 'test',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'first-runtime-key',
        NEXT_PUBLIC_SERVER_URL: 'https://runtime-origin.example.invalid///',
        VERCEL_PROJECT_PRODUCTION_URL: 'unused-platform.example.invalid',
      }
      runInNewContext(await readFile(bundle, 'utf8'), { exports, process: { env } })
      expect(exports.serverEnv.NEXT_PUBLIC_SERVER_URL).toBe(
        'https://runtime-origin.example.invalid',
      )
      expect(exports.getConfiguredServerURL()).toBe('https://runtime-origin.example.invalid')
      expect(exports.getTurnstileSiteKey()).toBe('first-runtime-key')
      env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = 'second-runtime-key'
      expect(exports.getTurnstileSiteKey()).toBe('second-runtime-key')
      env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = ''
      expect(exports.getTurnstileSiteKey()).toBeUndefined()
    } finally {
      await rm(distDir, { recursive: true, force: true })
    }
  })
})
