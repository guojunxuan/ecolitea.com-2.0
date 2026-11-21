// @vitest-environment node
import path from 'node:path'
import { sanitizeFilename } from 'payload/shared'
import {
  buildStoragePathData,
  getFilePrefix,
} from '@payloadcms/plugin-cloud-storage/utilities'
import { describe, expect, it } from 'vitest'

/**
 * Object keys are data-critical: existing R2 objects must keep resolving after the
 * Payload 4.0.0-beta.10 upgrade. canary.29's `getFileKey` was removed; beta.10's
 * `buildStoragePathData` is documented as "the exact location represented by persisted
 * upload metadata". These tests pin that the two compute identical keys.
 *
 * `oldSanitizePrefix` / `oldGetFileKey` are copied verbatim from
 * @payloadcms/plugin-cloud-storage@4.0.0-canary.29 (dist/utilities/sanitizePrefix.js and
 * getFileKey.js). `sanitizeFilename` from payload/shared is byte-identical between
 * canary.29 and beta.10, so it is shared.
 */
function oldSanitizePrefix(prefix: string): string {
  let decodedPrefix: string
  try {
    decodedPrefix = decodeURIComponent(prefix)
  } catch {
    return ''
  }
  if (/%[0-9a-f]{2}/i.test(decodedPrefix)) {
    return ''
  }
  return (
    decodedPrefix
      .replace(/\\/g, '/')
      .split('/')
      .filter((segment) => segment !== '..' && segment !== '.')
      .join('/')
      .replace(/^\/+/, '')
      .replace(/[\x00-\x1f\x80-\x9f]/g, '')
  )
}

function oldGetFileKey({
  collectionPrefix,
  docPrefix,
  filename,
  useCompositePrefixes = false,
}: {
  collectionPrefix?: string
  docPrefix?: string
  filename: string
  useCompositePrefixes?: boolean
}): string {
  const safeCollectionPrefix = oldSanitizePrefix(collectionPrefix || '')
  const safeDocPrefix = oldSanitizePrefix(docPrefix || '')
  const safeFilename = sanitizeFilename(filename)
  return useCompositePrefixes
    ? path.posix.join(safeCollectionPrefix, safeDocPrefix, safeFilename)
    : path.posix.join(safeDocPrefix || safeCollectionPrefix, safeFilename)
}

const urlFor = (base: string, key: string) =>
  `${base}/${key.split('/').map(encodeURIComponent).join('/')}`

const filenames = [
  'logo.svg',
  'photo.PNG',
  'my file (1).png',
  '图 片.png',
  '文件 名称.pdf',
  'é-ñ ü.webp',
  'emoji 😀.jpg',
  'a+b&c=d#e.png',
  'photo-400x300.png', // legacy image-size style variant filename
  'weird name  with   spaces.docx',
]

// [collectionPrefix, docPrefix] pairs seen in this project and the edge forms around them.
const prefixPairs: Array<[string | undefined, string | undefined]> = [
  [undefined, undefined], // no prefix at all (legacy root layout)
  ['', ''],
  ['media', undefined], // collection prefix only
  ['media', ''],
  ['media', 'media'], // stored doc prefix equals the collection prefix
  ['media', 'custom'], // non-composite: a doc prefix overrides the collection prefix
  ['documents', 'documents/2026/11'], // nested prefix
  ['site-assets', 'site-assets'],
  [undefined, 'legacy/root'], // old documents stored before collection prefixes existed
  ['media', '/media/'], // leading and trailing slashes
  ['media', 'media//nested'], // double slash
  ['media', 'media\\windows\\style'], // backslashes
  ['media', 'media%2Fencoded%2Fpath'], // single-encoded separators decode once
  ['media', 'with space/üñí'], // spaces and unicode inside a prefix
]

describe('storage object key compatibility: canary.29 getFileKey vs beta.10 buildStoragePathData', () => {
  for (const composite of [false, true]) {
    it(`computes identical keys for every representative prefix and filename (useCompositePrefixes: ${composite})`, () => {
      let checked = 0
      for (const [collectionPrefix, docPrefix] of prefixPairs) {
        for (const filename of filenames) {
          const expected = oldGetFileKey({
            collectionPrefix,
            docPrefix,
            filename,
            useCompositePrefixes: composite,
          })
          const actual = buildStoragePathData({
            collectionPrefix,
            docPrefix,
            filename,
            useCompositePrefixes: composite,
          }).storageFilePath
          expect(actual, JSON.stringify({ collectionPrefix, docPrefix, filename })).toBe(expected)
          checked++
        }
      }
      expect(checked).toBe(prefixPairs.length * filenames.length)
    })
  }

  it('produces identical public URLs through the project URL composition', () => {
    const base = 'https://media.example.invalid'
    for (const [collectionPrefix, docPrefix] of prefixPairs) {
      for (const filename of filenames) {
        const expected = urlFor(base, oldGetFileKey({ collectionPrefix, docPrefix, filename }))
        const actual = urlFor(
          base,
          buildStoragePathData({ collectionPrefix, docPrefix, filename }).storageFilePath,
        )
        expect(actual).toBe(expected)
      }
    }
  })

  it('pins concrete keys for the layouts this project stores', () => {
    const key = (collectionPrefix: string | undefined, docPrefix: string | undefined, name: string) =>
      buildStoragePathData({ collectionPrefix, docPrefix, filename: name }).storageFilePath
    expect(key('media', 'media', 'photo.png')).toBe('media/photo.png')
    expect(key('media', undefined, '图 片.png')).toBe('media/图 片.png')
    expect(key('documents', 'documents', 'spec sheet.pdf')).toBe('documents/spec sheet.pdf')
    expect(key('site-assets', '', 'logo.svg')).toBe('site-assets/logo.svg')
    expect(key(undefined, '', 'legacy.png')).toBe('legacy.png')
    expect(key(undefined, 'legacy/root', 'legacy.png')).toBe('legacy/root/legacy.png')
  })

  it('resolves an EXISTING document (no _objectKey) to the same folder as before', async () => {
    // Documents stored before the upgrade carry `prefix` but have no `_objectKey`.
    for (const prefix of ['media', 'documents/2026/11', 'site-assets', '', undefined]) {
      const folder = await getFilePrefix({
        doc: { filename: 'photo.png', prefix } as never,
        filename: 'photo.png',
      } as never)
      expect(folder).toBe(oldSanitizePrefix(prefix ?? ''))
    }
  })

  it('documents the NEW layout for uploads made after the upgrade (_objectKey folder)', async () => {
    const doc = { filename: 'photo.png', prefix: 'media', _objectKey: 'b1946ac9-92e1-4ba8-8c3e-0a1b2c3d4e5f' }
    const folder = await getFilePrefix({ doc: doc as never, filename: 'photo.png' } as never)
    expect(folder).toBe('media/b1946ac9-92e1-4ba8-8c3e-0a1b2c3d4e5f')
    expect(
      buildStoragePathData({ collectionPrefix: 'media', docPrefix: folder, filename: 'photo.png' })
        .storageFilePath,
    ).toBe('media/b1946ac9-92e1-4ba8-8c3e-0a1b2c3d4e5f/photo.png')
  })

  it('differs only for traversal-shaped prefixes that valid stored data never contains', () => {
    // sanitizePrefix became payload/shared sanitizeUploadPrefix: control characters are removed
    // BEFORE splitting, so ".\u0000." can no longer collapse into a ".." segment.
    const prefix = '.\u0000.'
    expect(oldGetFileKey({ docPrefix: prefix, filename: 'x.png' })).toBe('../x.png')
    expect(buildStoragePathData({ docPrefix: prefix, filename: 'x.png' }).storageFilePath).toBe(
      'x.png',
    )
  })
})
