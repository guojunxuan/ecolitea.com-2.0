import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/collections/parseMP4Metadata', () => ({
  parseMP4Metadata: vi.fn(async () => ({
    audioCodecs: ['mp4a.40.2'],
    durationSeconds: 42,
    width: 1920,
    height: 1080,
    videoCodecs: ['avc1.640028'],
  })),
}))

import { Media } from '@/collections/Media'
import { MEDIA_UPLOAD_POLICY, validateMediaUpload } from '@/collections/mediaUploadPolicy'
import { parseMP4Metadata } from '@/collections/parseMP4Metadata'

const mockedParseMP4Metadata = vi.mocked(parseMP4Metadata)

const getDurationField = () =>
  Media.fields.find((field) => 'name' in field && field.name === 'durationSeconds')

describe('Media collection upload behavior', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('stores only originals and uses the original URL in Payload Admin', () => {
    expect(Media.upload).toBeTypeOf('object')
    const upload = Media.upload
    if (!upload || typeof upload === 'boolean') throw new Error('Media upload config is missing.')

    expect(upload).not.toHaveProperty('imageSizes')
    expect(upload).not.toHaveProperty('resizeOptions')
    expect(upload).not.toHaveProperty('formatOptions')
    expect(upload.crop).toBe(false)
    expect(upload.focalPoint).toBe(false)
    expect(upload.adminThumbnail).toBeTypeOf('function')
    expect(
      (upload.adminThumbnail as (args: { doc: { url?: string | null } }) => string | undefined)({
        doc: { url: 'https://media.example.invalid/original.jpg' },
      }),
    ).toBe('https://media.example.invalid/original.jpg')
  })

  it('registers server-side upload validation', () => {
    expect(Media.hooks?.beforeValidate).toContain(validateMediaUpload)
  })

  it('defines provider-neutral video duration metadata for render-time delivery', () => {
    expect(getDurationField()).toMatchObject({
      name: 'durationSeconds',
      type: 'number',
      admin: {
        hidden: true,
        readOnly: true,
      },
    })
  })

  it('accepts an image with an allowed aspect ratio', async () => {
    const data = { height: 1200, mimeType: 'image/jpeg', width: 1600 }

    await expect(
      validateMediaUpload({
        data,
        operation: 'create',
        req: {
          file: { data: Buffer.from('image'), mimetype: 'image/jpeg', size: 20 },
        },
      } as never),
    ).resolves.toEqual({ ...data, durationSeconds: null })
  })

  it('preserves duration metadata by omission on metadata-only updates', async () => {
    const data = { alt: 'Updated only' }

    await expect(
      validateMediaUpload({
        data,
        operation: 'update',
        req: { file: undefined },
      } as never),
    ).resolves.toBe(data)

    expect(data).not.toHaveProperty('durationSeconds')
  })

  it('strips client-supplied duration metadata on metadata-only updates', async () => {
    await expect(
      validateMediaUpload({
        data: { alt: 'Updated only', durationSeconds: 12 },
        operation: 'update',
        req: { file: undefined },
      } as never),
    ).resolves.toEqual({ alt: 'Updated only' })
  })

  it('rejects images outside the configured aspect ratios with an API error', async () => {
    await expect(
      validateMediaUpload({
        data: { height: 1000, mimeType: 'image/jpeg', width: 1100 },
        operation: 'create',
        req: {
          file: { data: Buffer.from('image'), mimetype: 'image/jpeg', size: 20 },
        },
      } as never),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('rejects oversized MP4 uploads before parsing', async () => {
    await expect(
      validateMediaUpload({
        data: { mimeType: 'video/mp4' },
        operation: 'create',
        req: {
          file: {
            data: Buffer.from('video'),
            mimetype: 'video/mp4',
            size: MEDIA_UPLOAD_POLICY.video.maxBytes + 1,
          },
        },
      } as never),
    ).rejects.toMatchObject({ status: 400 })

    expect(mockedParseMP4Metadata).not.toHaveBeenCalled()
  })

  it('rejects oversized generated file data when req.file.size is unavailable', async () => {
    await expect(
      validateMediaUpload({
        data: {
          filesize: MEDIA_UPLOAD_POLICY.video.maxBytes + 1,
          mimeType: 'video/mp4',
        },
        operation: 'create',
        req: {
          file: {
            data: Buffer.from('video'),
            mimetype: 'video/mp4',
            size: undefined,
          },
        },
      } as never),
    ).rejects.toMatchObject({ status: 400 })

    expect(mockedParseMP4Metadata).not.toHaveBeenCalled()
  })

  it('rejects non-MP4 video uploads before parsing', async () => {
    await expect(
      validateMediaUpload({
        data: { mimeType: 'video/webm' },
        operation: 'create',
        req: {
          file: { data: Buffer.from('video'), mimetype: 'video/webm', size: 20 },
        },
      } as never),
    ).rejects.toMatchObject({ status: 400 })

    expect(mockedParseMP4Metadata).not.toHaveBeenCalled()
  })

  it('rejects SVG uploads because site-assets owns SVG resources', async () => {
    expect(MEDIA_UPLOAD_POLICY.image.mimeTypes).not.toContain('image/svg+xml')

    await expect(
      validateMediaUpload({
        data: { height: 100, mimeType: 'image/svg+xml', width: 100 },
        operation: 'create',
        req: {
          file: { data: Buffer.from('<svg/>'), mimetype: 'image/svg+xml', size: 6 },
        },
      } as never),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('persists validated source duration for videos', async () => {
    const data = { mimeType: 'video/mp4' }

    await expect(
      validateMediaUpload({
        data,
        operation: 'create',
        req: {
          file: { data: Buffer.from('video'), mimetype: 'video/mp4', size: 20 },
        },
      } as never),
    ).resolves.toEqual({ mimeType: 'video/mp4', durationSeconds: 42, width: 1920, height: 1080 })

    expect(mockedParseMP4Metadata).toHaveBeenCalledWith(Buffer.from('video'))
  })

  it('clears stale video duration when a non-video file replaces it', async () => {
    await expect(
      validateMediaUpload({
        data: { height: 1000, mimeType: 'image/png', width: 1000 },
        operation: 'update',
        req: {
          file: { data: Buffer.from('image'), mimetype: 'image/png', size: 20 },
        },
      } as never),
    ).resolves.toMatchObject({ durationSeconds: null })
  })
})

describe('Media Admin policies', () => {
  it('restricts MIME types, disables versions/duplicate and improves search and columns', () => {
    expect(Media.versions).toBe(false)
    expect(Media.disableDuplicate).toBe(true)
    expect(Media.admin).toMatchObject({
      listSearchableFields: ['filename', 'alt'],
      defaultColumns: [
        'filename',
        'alt',
        'mimeType',
        'width',
        'filesize',
        '_h_folders',
        'updatedAt',
      ],
    })
    expect(Media.admin?.description).toContain('16:9')
    expect(Media.upload).toMatchObject({
      mimeTypes: [...MEDIA_UPLOAD_POLICY.image.mimeTypes, 'video/mp4'],
    })
    expect(Media.fields.find((f) => 'name' in f && f.name === 'alt')).toMatchObject({ index: true })
  })
  it.each(['application/pdf', 'image/svg+xml', 'application/octet-stream'])(
    'rejects %s with the complete allowed types',
    async (mimetype) => {
      await expect(
        validateMediaUpload({
          data: {},
          req: { file: { mimetype, data: Buffer.from('bad') } },
        } as never),
      ).rejects.toThrow(
        `Unsupported file type: ${mimetype}. Media accepts images (JPEG, PNG, WebP, AVIF, GIF) and video (MP4).`,
      )
    },
  )
})

describe('Media source metadata integrity', () => {
  it('strips forged display dimensions on metadata-only writes', async () => {
    await expect(
      validateMediaUpload({
        data: { width: 999, height: 999, alt: 'Tea garden' },
        req: {},
      } as never),
    ).resolves.toEqual({ alt: 'Tea garden' })
  })
  it.each(MEDIA_UPLOAD_POLICY.image.mimeTypes)(
    'accepts the %s whitelist entry',
    async (mimetype) => {
      await expect(
        validateMediaUpload({
          data: { width: 1000, height: 1000 },
          req: { file: { mimetype, data: Buffer.from('image') } },
        } as never),
      ).resolves.toMatchObject({ width: 1000, height: 1000 })
    },
  )
})

describe('Media list projection', () => {
  it('includes height when the sortable width column is selected', () => {
    expect(Media.select).toBeTypeOf('function')
    expect(
      Media.select?.({ select: { width: true }, operation: 'read', req: {} } as never),
    ).toEqual({ width: true, height: true })
    expect(
      Media.select?.({ select: { alt: true }, operation: 'read', req: {} } as never),
    ).toBeUndefined()
    expect(
      Media.select?.({ select: { width: false }, operation: 'read', req: {} } as never),
    ).toBeUndefined()
  })
})
