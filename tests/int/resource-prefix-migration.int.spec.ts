// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import {
  createInventory,
  runMigrationStage,
  parseArguments,
  parseMigrationDatabase,
  assertConnectedDatabase,
  type MigrationServices,
} from '../../scripts/migrate-resource-prefixes'

const target = {
  database: 'mongodb://localhost:27017/prefix-test',
  bucket: 'test',
  endpoint: 'http://localhost:9000',
  publicURL: 'https://files.example.invalid',
}
const page = (docs: unknown[], number = 1, totalDocs = docs.length, totalPages = 1) => ({
  docs,
  page: number,
  totalDocs,
  totalPages,
  hasNextPage: number < totalPages,
  nextPage: number < totalPages ? number + 1 : null,
})
function fixture() {
  const docs: Record<string, Array<Record<string, unknown>>> = {
    media: [{ id: 'm', filename: 'photo.jpg', prefix: '', url: `${target.publicURL}/photo.jpg` }],
    'site-assets': [],
    pages: [],
  }
  const objects = new Map([['photo.jpg', 'same-bytes']])
  const find = vi.fn(async ({ collection, page: number }: { collection: string; page: number }) =>
    page(docs[collection] ?? [], number),
  )
  const update = vi.fn(
    async ({
      collection,
      id,
      data,
    }: {
      collection: string
      id: string
      data: Record<string, unknown>
    }) =>
      Object.assign(
        docs[collection].find((doc) => doc.id === id)!,
        data,
      ),
  )
  const payload = {
    config: {
      routes: { admin: '/admin' },
      collections: [{ slug: 'media' }, { slug: 'site-assets' }, { slug: 'pages' }],
      globals: [],
    },
    find,
    update,
    findVersions: vi.fn(),
    findByID: vi.fn(async ({ collection, id }) => docs[collection].find((doc) => doc.id === id)),
    delete: vi.fn(),
  } as unknown as Payload
  const services: MigrationServices = {
    payload,
    target,
    storage: {
      head: async (key) => (objects.has(key) ? { etag: objects.get(key)!, size: 10 } : null),
      copy: vi.fn(async (source, destination) => {
        objects.set(destination, objects.get(source)!)
      }),
      remove: vi.fn(async (key) => {
        objects.delete(key)
      }),
    },
    checkURL: vi.fn(async () => 200),
    scanSourceURLs: vi.fn(async () => []),
    versions: { inventory: vi.fn(async () => []), remove: vi.fn(async () => {}) },
    save: vi.fn(async () => {}),
  }
  return { docs, objects, services, find, update }
}

async function staged() {
  const f = fixture()
  const manifest = await createInventory(f.services)
  await runMigrationStage('copy', manifest, f.services, { execute: true })
  await runMigrationStage('update', manifest, f.services, { execute: true })
  return { ...f, manifest }
}

describe('guarded resource prefix migration (mock storage only)', () => {
  it('defaults to dry-run and requires explicit target/report and separate destructive confirmations', () => {
    expect(parseArguments(['--report=/tmp/report.json']).execute).toBe(false)
    expect(() =>
      parseArguments(['--execute', '--stage=remove-originals', '--report=/tmp/report.json']),
    ).toThrow(/confirmation/i)
    expect(() => parseArguments(['--stage=unexpected'])).toThrow()
  })
  it('inventories every page and reports missing originals and historical/current references', async () => {
    const f = fixture()
    f.docs.pages = [{ id: 'page', image: 'm' }]
    f.objects.clear()
    f.find.mockImplementation(async ({ collection, page: number }) =>
      collection === 'media'
        ? page(
            [
              {
                id: `m${number}`,
                filename: `${number}.jpg`,
                url: `${target.publicURL}/${number}.jpg`,
              },
            ],
            number,
            2,
            2,
          )
        : page(f.docs[collection] ?? [], number),
    )
    const manifest = await createInventory(f.services)
    expect(manifest.items).toHaveLength(2)
    expect(manifest.items.every((item) => item.files[0].source === null)).toBe(true)
    expect(f.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', page: 2 }))
  })
  it('fails closed on incomplete pagination', async () => {
    const f = fixture()
    f.find.mockResolvedValue({ ...page([]), totalDocs: 1 })
    await expect(createInventory(f.services)).rejects.toThrow(/incomplete/i)
  })
  it('does not write by default even when a mutation stage is selected', async () => {
    const f = fixture()
    const manifest = await createInventory(f.services)
    await runMigrationStage('copy', manifest, f.services)
    expect(f.services.storage.copy).not.toHaveBeenCalled()
    expect(f.update).not.toHaveBeenCalled()
  })
  it('preserves sources on copy/update failures and never updates after a failed copy', async () => {
    const f = fixture()
    const manifest = await createInventory(f.services)
    vi.mocked(f.services.storage.copy).mockRejectedValueOnce(new Error('copy failed'))
    await expect(
      runMigrationStage('copy', manifest, f.services, { execute: true }),
    ).rejects.toThrow('copy failed')
    await expect(
      runMigrationStage('update', manifest, f.services, { execute: true }),
    ).rejects.toThrow(/copied/i)
    expect(f.update).not.toHaveBeenCalled()
    await runMigrationStage('copy', manifest, f.services, { execute: true })
    f.update.mockRejectedValueOnce(new Error('update failed'))
    await expect(
      runMigrationStage('update', manifest, f.services, { execute: true }),
    ).rejects.toThrow('update failed')
    expect(f.objects.has('photo.jpg')).toBe(true)
    expect(manifest.items[0].before).toMatchObject({
      prefix: '',
      url: `${target.publicURL}/photo.jpg`,
    })
  })
  it('resumes idempotently and verifies 200 before allowing separately confirmed source removal', async () => {
    const f = await staged()
    await runMigrationStage('copy', f.manifest, f.services, { execute: true })
    await runMigrationStage('update', f.manifest, f.services, { execute: true })
    expect(f.services.storage.copy).toHaveBeenCalledTimes(1)
    expect(f.update).toHaveBeenCalledTimes(1)
    vi.mocked(f.services.checkURL).mockResolvedValueOnce(403)
    await expect(
      runMigrationStage('verify', f.manifest, f.services, { execute: true }),
    ).rejects.toThrow(/200/)
    await expect(
      runMigrationStage('remove-originals', f.manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
      }),
    ).rejects.toThrow(/verified/i)
    await runMigrationStage('verify', f.manifest, f.services, { execute: true })
    await runMigrationStage('remove-originals', f.manifest, f.services, {
      execute: true,
      confirm: 'remove-originals',
    })
    expect(f.objects.has('photo.jpg')).toBe(false)
    expect(f.objects.has('media/photo.jpg')).toBe(true)
  })
  it('blocks deletion when current content or source files contain hardcoded source URLs', async () => {
    const f = await staged()
    await runMigrationStage('verify', f.manifest, f.services, { execute: true })
    f.docs.pages.push({ id: 'p', html: `<img src="${target.publicURL}/photo.jpg">` })
    await expect(
      runMigrationStage('remove-originals', f.manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
      }),
    ).rejects.toThrow(/hardcoded/i)
    f.docs.pages = []
    vi.mocked(f.services.scanSourceURLs).mockResolvedValueOnce(['src/legacy.ts:1'])
    await expect(
      runMigrationStage('remove-originals', f.manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
      }),
    ).rejects.toThrow(/hardcoded/i)
    expect(f.services.storage.remove).not.toHaveBeenCalled()
  })
  it('reports current and historical media references and refuses missing record deletion', async () => {
    const f = fixture()
    f.objects.clear()
    f.docs.pages.push({ id: 'p', image: 'm' })
    f.services.payload.config.collections.find((c) => c.slug === 'pages')!.versions = {} as never
    vi.mocked(f.services.payload.findVersions).mockResolvedValue(
      page([{ id: 'v', parent: 'p', version: { image: 'm' } }]) as never,
    )
    const manifest = await createInventory(f.services)
    expect(manifest.references.map((r) => r.kind).sort()).toEqual(['current', 'version'])
    await expect(
      runMigrationStage('remove-originals', manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
        deleteMissingMedia: ['m'],
      }),
    ).rejects.toThrow(/referenced/i)
    expect(f.services.payload.delete).not.toHaveBeenCalled()
  })
  it('requires a version inventory and a distinct confirmation, rechecking exact IDs', async () => {
    const f = fixture()
    const versions = [{ id: 'v1', backup: { _id: 'v1', version: { filename: 'old.jpg' } } }]
    vi.mocked(f.services.versions.inventory).mockImplementation(async () => versions)
    vi.mocked(f.services.versions.remove).mockImplementation(async () => {
      versions.length = 0
    })
    const manifest = await createInventory(f.services)
    await expect(
      runMigrationStage('purge-media-versions', manifest, f.services, { execute: true }),
    ).rejects.toThrow(/confirmation/i)
    await runMigrationStage('purge-media-versions', manifest, f.services, {
      execute: true,
      confirm: 'purge-media-versions',
    })
    expect(f.services.versions.remove).toHaveBeenCalledWith(['v1'])
  })
})

describe('installed S3 plugin key/URL agreement, no sockets or database', () => {
  it('uses the installed upload hook for explicit, empty and absent prefixes', async () => {
    const { Readable } = await import('node:stream')
    const { s3Storage } = await import('@payloadcms/storage-s3')
    const { getFileKey } = await import('@payloadcms/plugin-cloud-storage/utilities')
    vi.stubEnv('R2_PUBLIC_URL', target.publicURL)
    const { generateR2FileURL, r2StorageCollections } = await import('@/plugins')
    const requests: Array<{ path: string; method: string }> = []
    const adapter = s3Storage({
      bucket: 'test-bucket',
      collections: r2StorageCollections,
      clientCacheKey: 'task7-key-parity',
      config: {
        credentials: { accessKeyId: 'local-placeholder', secretAccessKey: 'local-placeholder' },
        endpoint: 'http://localhost:9000',
        forcePathStyle: true,
        region: 'auto',
        requestHandler: {
          handle: async (request: { path: string; method: string }) => {
            requests.push(request)
            return {
              response: {
                statusCode: 200,
                headers: { etag: 'local-etag' },
                body: Readable.from([]),
              },
            }
          },
        },
      },
    })
    const configured = await adapter.init({
      collections: ['media', 'site-assets', 'documents'].map((slug) => ({
        slug,
        fields: [],
        upload: true,
      })),
    } as never)
    for (const collection of configured.collections!) {
      for (const prefix of [undefined, '', 'custom/子 路径', '/odd/../path']) {
        const data = {
          id: 'local-doc',
          filename: '图 片.png',
          mimeType: 'image/png',
          ...(prefix === undefined ? {} : { prefix }),
        }
        const expected = getFileKey({
          collectionPrefix: collection.slug,
          docPrefix: prefix,
          filename: data.filename,
        }).fileKey
        const req = {
          context: {},
          file: { data: Buffer.from('local'), size: 5 },
          payload: { update: vi.fn(), logger: { error: vi.fn() } },
        }
        const hook = collection.hooks!.afterChange!.at(-1)!
        await hook({ doc: data, operation: 'create', req } as never)
        const uploadedKey = decodeURIComponent(requests.at(-1)!.path.replace('/test-bucket/', ''))
        expect(uploadedKey).toBe(expected)
        const urlField = collection.fields.find((field) => 'name' in field && field.name === 'url')!
        const generated = await ('hooks' in urlField &&
          urlField.hooks!.afterRead![0]({ data } as never))
        expect(new URL(generated as string).pathname).toBe(
          `/${expected.split('/').map(encodeURIComponent).join('/')}`,
        )
        expect(
          generateR2FileURL({ filename: data.filename, prefix, collectionPrefix: collection.slug }),
        ).toBe(generated)
      }
    }
    expect(requests).toHaveLength(12)
    vi.unstubAllEnvs()
  })
})

describe('migration inventory binding and recovery guards', () => {
  it('rejects a replay against another target and a modified inventory', async () => {
    const f = fixture()
    const manifest = await createInventory(f.services)
    await expect(
      runMigrationStage(
        'copy',
        manifest,
        { ...f.services, target: { ...target, bucket: 'other' } },
        { execute: true },
      ),
    ).rejects.toThrow(/target mismatch/i)
    manifest.items[0].files[0].sourceKey = 'unapproved.jpg'
    await expect(
      runMigrationStage('copy', manifest, f.services, { execute: true }),
    ).rejects.toThrow(/inventory.*mismatch/i)
    expect(f.services.storage.copy).not.toHaveBeenCalled()
  })
  it('records exact stored fields before computed URL hooks and field absence for rollback', async () => {
    const f = fixture()
    f.docs.media[0].url = `${target.publicURL}/incorrect-computed.jpg`
    f.services.readStored = async () => ({
      id: 'm',
      filename: 'photo.jpg',
      url: `${target.publicURL}/photo.jpg`,
    })
    const manifest = await createInventory(f.services)
    expect(manifest.items[0].before.url).toBe(`${target.publicURL}/photo.jpg`)
    expect(manifest.items[0].absentFields).toEqual(['prefix'])
  })
  it('refuses destination collisions and source changes without overwriting', async () => {
    const f = fixture()
    const manifest = await createInventory(f.services)
    f.objects.set('media/photo.jpg', 'different-bytes')
    await expect(
      runMigrationStage('copy', manifest, f.services, { execute: true }),
    ).rejects.toThrow(/collision/i)
    f.objects.delete('media/photo.jpg')
    f.objects.set('photo.jpg', 'changed-source')
    await expect(
      runMigrationStage('copy', manifest, f.services, { execute: true }),
    ).rejects.toThrow(/source changed/i)
    expect(f.services.storage.copy).not.toHaveBeenCalled()
  })
  it('keeps missing records through copy/update and requires selected, unreferenced, fully missing records', async () => {
    const f = fixture()
    f.objects.clear()
    const manifest = await createInventory(f.services)
    await runMigrationStage('copy', manifest, f.services, { execute: true })
    await runMigrationStage('update', manifest, f.services, { execute: true })
    expect(f.update).not.toHaveBeenCalled()
    await runMigrationStage('remove-originals', manifest, f.services, {
      execute: true,
      confirm: 'remove-originals',
      deleteMissingMedia: ['m'],
    })
    expect(f.services.payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 'm' }),
    )
  })
  it('does not delete a missing Media record if a destination exists or references appeared since inventory', async () => {
    const f = fixture()
    f.objects.clear()
    const manifest = await createInventory(f.services)
    f.docs.pages.push({ id: 'new-page', image: 'm' })
    await expect(
      runMigrationStage('remove-originals', manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
        deleteMissingMedia: ['m'],
      }),
    ).rejects.toThrow(/referenced/i)
    f.docs.pages = []
    f.objects.set('media/photo.jpg', 'other-data')
    await expect(
      runMigrationStage('remove-originals', manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
        deleteMissingMedia: ['m'],
      }),
    ).rejects.toThrow(/now exists/i)
    expect(f.services.payload.delete).not.toHaveBeenCalled()
  })
  it('does not mark update complete when Payload does not persist planned metadata', async () => {
    const f = fixture()
    const manifest = await createInventory(f.services)
    await runMigrationStage('copy', manifest, f.services, { execute: true })
    f.update.mockResolvedValueOnce({ id: 'm' })
    await expect(
      runMigrationStage('update', manifest, f.services, { execute: true }),
    ).rejects.toThrow(/persist/i)
    expect(manifest.items[0].updated).not.toBe(true)
    expect(f.objects.has('photo.jpg')).toBe(true)
  })
  it('resumes a missing-record delete after the database write but before checkpoint', async () => {
    const f = fixture()
    f.objects.clear()
    const manifest = await createInventory(f.services)
    f.docs.media = [] // Simulate a successful delete followed by a lost local checkpoint.
    await runMigrationStage('remove-originals', manifest, f.services, {
      execute: true,
      confirm: 'remove-originals',
      deleteMissingMedia: ['m'],
    })
    expect(manifest.items[0].missingDeleted).toBe(true)
    expect(f.services.payload.delete).not.toHaveBeenCalled()
  })
  it('resumes version purge without mutating the immutable backup inventory', async () => {
    const f = fixture()
    const versions = [{ id: 'v1', backup: { _id: 'v1', version: { filename: 'old.jpg' } } }]
    vi.mocked(f.services.versions.inventory).mockImplementation(async () => versions)
    vi.mocked(f.services.versions.remove).mockImplementation(async () => {
      versions.length = 0
    })
    const manifest = await createInventory(f.services)
    await runMigrationStage('purge-media-versions', manifest, f.services, {
      execute: true,
      confirm: 'purge-media-versions',
    })
    await runMigrationStage('purge-media-versions', manifest, f.services, {
      execute: true,
      confirm: 'purge-media-versions',
    })
    expect(manifest.mediaVersions).toHaveLength(1)
    expect(f.services.versions.remove).toHaveBeenCalledTimes(1)
  })
  it('refuses source deletion after the verified destination changes', async () => {
    const f = await staged()
    await runMigrationStage('verify', f.manifest, f.services, { execute: true })
    f.objects.set('media/photo.jpg', 'changed-destination')
    await expect(
      runMigrationStage('remove-originals', f.manifest, f.services, {
        execute: true,
        confirm: 'remove-originals',
      }),
    ).rejects.toThrow(/verified/i)
    expect(f.services.storage.remove).not.toHaveBeenCalled()
  })
})

describe('reviewed storage and database target guards', () => {
  it('rejects cross-collection source/destination overlap even with identical objects', async () => {
    const f = fixture()
    f.docs['site-assets'].push({
      id: 'a',
      filename: 'photo.jpg',
      prefix: 'media',
      url: `${target.publicURL}/media/photo.jpg`,
    })
    f.objects.set('media/photo.jpg', 'same-bytes')
    await expect(createInventory(f.services)).rejects.toThrow(/source.*destination.*overlap/i)
    expect(f.services.storage.copy).not.toHaveBeenCalled()
    expect(f.update).not.toHaveBeenCalled()
    expect(f.services.storage.remove).not.toHaveBeenCalled()
    expect(f.services.save).not.toHaveBeenCalled()
  })
  it.each(['copy', 'update', 'remove-originals'] as const)(
    'rejects overlapping historical manifests before %s',
    async (stage) => {
      const f = fixture()
      const manifest = await createInventory(f.services)
      const asset = structuredClone(manifest.items[0])
      asset.collection = 'site-assets'
      asset.id = 'a'
      asset.before = { prefix: 'media', url: `${target.publicURL}/media/photo.jpg` }
      asset.after = { prefix: 'site-assets', url: `${target.publicURL}/site-assets/photo.jpg` }
      Object.assign(asset.files[0], {
        sourceKey: 'media/photo.jpg',
        destinationKey: 'site-assets/photo.jpg',
        oldURL: asset.before.url,
        newURL: asset.after.url,
      })
      manifest.items.push(asset)
      // Digest from the valid v1 report produced by the pre-guard implementation.
      manifest.digest = '8ecd4faf46c4769cbbbf318aedca8060a29353703512e9c5fb998d085f5f8f4f'
      f.docs['site-assets'].push({ id: 'a', filename: 'photo.jpg', ...asset.before })
      f.objects.set('media/photo.jpg', 'same-bytes')
      if (stage !== 'copy') {
        f.objects.set('site-assets/photo.jpg', 'same-bytes')
        for (const item of manifest.items) for (const file of item.files) file.copied = true
      }
      if (stage === 'remove-originals')
        for (const item of manifest.items) {
          item.updated = true
          for (const file of item.files) file.verified = true
          Object.assign(f.docs[item.collection][0], item.after)
        }
      await expect(
        runMigrationStage(stage, manifest, f.services, { execute: true, confirm: stage }),
      ).rejects.toThrow(/source.*destination.*overlap/i)
      expect(f.services.storage.copy).not.toHaveBeenCalled()
      expect(f.update).not.toHaveBeenCalled()
      expect(f.services.storage.remove).not.toHaveBeenCalled()
    },
  )
  it('permits an object whose source and destination belong only to that same file', async () => {
    const f = fixture()
    f.docs.media[0].prefix = 'media'
    f.docs.media[0].url = `${target.publicURL}/media/photo.jpg`
    f.objects.set('media/photo.jpg', 'same-bytes')
    const manifest = await createInventory(f.services)
    await runMigrationStage('copy', manifest, f.services, { execute: true })
    expect(f.services.storage.copy).not.toHaveBeenCalled()
  })
  it.each([
    'mongodb://localhost:27017',
    'mongodb://localhost:27017/',
    'mongodb://localhost:27017/?authSource=admin',
  ])('rejects a missing explicit database before reporting target %s', (uri) => {
    expect(() => parseMigrationDatabase(uri)).toThrow(/explicit database name/i)
  })
  it('decodes the approved database name and removes credentials from its report', () => {
    const database = parseMigrationDatabase(
      'mongodb://user:secret@localhost:27017/prefix%2Dtest?authSource=admin',
    )
    expect(database.name).toBe('prefix-test')
    expect(database.target).toBe('mongodb://localhost:27017/prefix-test')
    expect(database.target).not.toContain('secret')
    expect(() => assertConnectedDatabase(database, 'prefix-test')).not.toThrow()
    expect(() => assertConnectedDatabase(database, 'test')).toThrow(
      /connected database.*does not match/i,
    )
    expect(() => assertConnectedDatabase(database, undefined)).toThrow(/connected database/i)
  })
  it.each([
    'mongodb://localhost:27017/%2F',
    'mongodb://localhost:27017/%20',
    'mongodb://localhost:27017/bad%ZZ',
    'mongodb://localhost:27017/one/two',
  ])('rejects ambiguous or invalid encoded database paths %s', (uri) => {
    expect(() => parseMigrationDatabase(uri)).toThrow(
      /invalid database name|explicit database name/i,
    )
  })
})
