// @vitest-environment node
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'
import { transformSync } from 'next/dist/build/swc'
import { inlineStaticEnv } from 'next/dist/lib/inline-static-env'
import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => vi.unstubAllEnvs())

describe('runtime public environment build boundary', () => {
  it('reads the runtime site key after Next minification and environment generation', async () => {
    const distDir = await mkdtemp(path.join(tmpdir(), 'runtime-env-build-'))
    try {
      const source = await readFile(new URL('../../src/utilities/env.ts', import.meta.url), 'utf8')
      const { code } = transformSync(source, {
        jsc: {
          parser: { syntax: 'typescript' },
          target: 'es2022',
          minify: { compress: true, mangle: true },
        },
        module: { type: 'commonjs' },
        minify: true,
      })
      await mkdir(path.join(distDir, 'server'))
      await mkdir(path.join(distDir, 'static'))
      const bundle = path.join(distDir, 'server', 'env.js')
      await writeFile(bundle, code)
      // Exercise only this public setting, independent of a developer's local .env.
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

      const exports = {} as {
        getTurnstileSiteKey: () => string | undefined
        serverEnv: { NEXT_PUBLIC_SERVER_URL: string }
      }
      const env = {
        NODE_ENV: 'test',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'first-runtime-key',
        NEXT_PUBLIC_SERVER_URL: 'https://runtime-origin.example.invalid///',
      }
      runInNewContext(await readFile(bundle, 'utf8'), { exports, process: { env } })
      expect(exports.serverEnv.NEXT_PUBLIC_SERVER_URL).toBe(
        'https://runtime-origin.example.invalid',
      )
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
