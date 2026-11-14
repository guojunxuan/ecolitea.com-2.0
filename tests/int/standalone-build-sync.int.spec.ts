// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)
// Use the installed implementation: its chunk renaming is the build boundary under test.
const { inlineStaticEnv } = require('next/dist/lib/inline-static-env.js') as {
  inlineStaticEnv: (options: {
    distDir: string
    config: { env: Record<string, string> }
  }) => Promise<void>
}
const script = fileURLToPath(new URL('../../scripts/sync-standalone-build.mjs', import.meta.url))
const temporaryDirectories: string[] = []

afterEach(async () => {
  vi.unstubAllEnvs()
  await Promise.all(temporaryDirectories.splice(0).map((dir) => rm(dir, { recursive: true })))
})

const fixture = async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'ecolitea-standalone-sync-'))
  temporaryDirectories.push(directory)
  const build = path.join(directory, '.next')
  const standalone = path.join(build, 'standalone')
  const target = path.join(standalone, '.next')
  await mkdir(path.join(build, 'server', 'app'), { recursive: true })
  await mkdir(path.join(build, 'static', 'chunks'), { recursive: true })
  await mkdir(target, { recursive: true })
  return { directory, build, standalone, target }
}

const synchronize = (directory: string) => {
  const result = spawnSync(process.execPath, [script], { cwd: directory, encoding: 'utf8' })
  expect(result.stderr).toBe('')
  expect(result.status).toBe(0)
}

describe('standalone build synchronization', () => {
  it('repairs standalone chunk references after Next generate-env renames client files', async () => {
    const { directory, build, target } = await fixture()
    const oldChunk = 'client-0123456789abcdef.js'
    const reference = JSON.stringify({ scripts: [`static/chunks/${oldChunk}`] })
    const manifests = ['build-manifest.json', 'runtime.js', 'runtime.js.map']
    const serverManifest = path.join('server', 'app', 'page_client-reference-manifest.js')
    await writeFile(
      path.join(build, 'static', 'chunks', oldChunk),
      'const key = process.env.NEXT_PUBLIC_STANDALONE_SYNC_FIXTURE;',
    )
    await writeFile(path.join(build, serverManifest), `globalThis.clientManifest = ${reference}`)
    await cp(path.join(build, 'server'), path.join(target, 'server'), { recursive: true })
    for (const manifest of manifests) {
      await writeFile(path.join(build, manifest), reference)
      await writeFile(path.join(target, manifest), reference)
    }

    vi.stubEnv('NEXT_PUBLIC_STANDALONE_SYNC_FIXTURE', 'fixture-public-key')
    await inlineStaticEnv({ distDir: build, config: { env: {} } })

    const [newChunk] = await readdir(path.join(build, 'static', 'chunks'))
    expect(newChunk).not.toBe(oldChunk)
    expect(await readFile(path.join(build, serverManifest), 'utf8')).toContain(newChunk)
    // compile already copied standalone, and generate-env does not update that copy.
    expect(await readFile(path.join(target, serverManifest), 'utf8')).toContain(oldChunk)
    expect(await readFile(path.join(target, manifests[0]), 'utf8')).toContain(oldChunk)

    synchronize(directory)

    for (const manifest of [serverManifest, ...manifests]) {
      const content = await readFile(path.join(target, manifest), 'utf8')
      expect(content).toBe(await readFile(path.join(build, manifest), 'utf8'))
      expect(content).toContain(newChunk)
      expect(content).not.toContain(oldChunk)
    }
  })

  it('preserves the standalone runtime and leaves static and cache copying to their owners', async () => {
    const { directory, build, standalone, target } = await fixture()
    await writeFile(path.join(standalone, 'server.js'), 'standalone runtime')
    await writeFile(path.join(build, 'server', 'app', 'page.js'), 'server route')
    await writeFile(path.join(build, 'trace'), 'build tracing data')
    await mkdir(path.join(build, 'cache'), { recursive: true })
    await writeFile(path.join(build, 'cache', 'entry.json'), 'cached build data')
    // A directory with a manifest suffix must not be treated as a file to copy.
    await mkdir(path.join(build, 'excluded.json'))
    await writeFile(path.join(build, 'excluded.json', 'entry.js'), 'unrelated build directory')

    synchronize(directory)

    expect(await readFile(path.join(target, 'server', 'app', 'page.js'), 'utf8')).toBe('server route')
    expect(await readFile(path.join(standalone, 'server.js'), 'utf8')).toBe('standalone runtime')
    expect(await readdir(target)).toEqual(['server'])
  })
})
