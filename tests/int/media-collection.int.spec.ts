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

import { APIError, ValidationError } from 'payload'
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

  it('stores only originals and uses authenticated same-origin file links in Payload Admin', () => {
    expect(Media.upload).toBeTypeOf('object')
    const upload = Media.upload
    if (!upload || typeof upload === 'boolean') throw new Error('Media upload config is missing.')

    expect(upload).not.toHaveProperty('imageSizes')
    expect(upload).not.toHaveProperty('resizeOptions')
    expect(upload).not.toHaveProperty('formatOptions')
    expect(upload.crop).toBe(false)
    expect(upload.focalPoint).toBe(true)
    expect(upload.adminThumbnail).toBeTypeOf('function')
    expect(
      (
        upload.adminThumbnail as (args: {
          doc: { id: string; url?: string | null }
        }) => string | undefined
      )({
        doc: { id: '123', url: 'https://media.example.invalid/original.jpg' },
      }),
    ).toBe('http://localhost:3000/api/media/123/file')
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
    expect(Media.admin?.description).toBeUndefined()
    expect(Media.upload).toMatchObject({
      mimeTypes: [...MEDIA_UPLOAD_POLICY.image.mimeTypes, 'video/mp4'],
    })
    expect(Media.fields.find((f) => 'name' in f && f.name === 'alt')).toMatchObject({
      index: true,
      required: true,
    })
  })
  it.each(['application/pdf', 'image/svg+xml', 'application/octet-stream'])(
    'rejects %s with the complete allowed types',
    async (mimetype) => {
      await expect(
        validateMediaUpload({
          data: {},
          req: { file: { mimetype, data: Buffer.from('bad') } },
        } as never),
      ).rejects.toThrow('Unsupported file type. Use JPEG, PNG, WebP, AVIF, GIF or MP4.')
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

describe('editor-facing video errors', () => {
  const run = (file = {}) =>
    validateMediaUpload({
      data: {},
      req: { file: { data: Buffer.from('video'), mimetype: 'video/mp4', size: 5, ...file } },
    } as never)
  it('reports actual video size in rounded MB', async () => {
    await expect(run({ size: 148_400_000 })).rejects.toThrow(
      'Video is too large (148 MB). Maximum is 100 MB.',
    )
  })
  it('hides parser internals and logs the technical reason', async () => {
    const error = new Error('MP4 parser error: invalid atom at /private/source.mp4')
    mockedParseMP4Metadata.mockRejectedValueOnce(error)
    const warn = vi.fn()
    await expect(
      validateMediaUpload({
        data: {},
        req: {
          payload: { logger: { warn } },
          file: { data: Buffer.from('video'), mimetype: 'video/mp4' },
        },
      } as never),
    ).rejects.toThrow("Video can't be read. Try exporting it again.")
    expect(warn).toHaveBeenCalledWith(expect.objectContaining({ err: error }), expect.any(String))
  })
  it('maps a recognized fast-start error to export guidance', async () => {
    mockedParseMP4Metadata.mockRejectedValueOnce(
      Object.assign(new Error('mdat precedes moov'), { code: 'FAST_START_REQUIRED' }),
    )
    await expect(run()).rejects.toThrow(
      "Video isn't web-optimized. Export again with Fast Start on.",
    )
  })
  it('does not expose filesystem read failures', async () => {
    await expect(run({ tempFilePath: '/nonexistent-test-video-path.mp4' })).rejects.toThrow(
      "Video can't be read. Try exporting it again.",
    )
  })
})

describe('Media upload error response formatting', () => {
  const hook = () => {
    const handler = Media.hooks?.afterError?.[0]
    if (!handler) throw new Error('Media afterError hook is missing')
    return handler
  }
  it('preserves literal ratio colons in a top-level message and keeps the error array', async () => {
    const message = 'Video ratio not supported (1440 × 1080). Use 16:9, 9:16, 1:1 or 4:5.'
    const error = new APIError(message, 400, { mediaUpload: true })
    const result = { errors: [{ message }] }
    expect(await hook()({ error, result } as never)).toEqual({ response: { ...result, message } })
  })
  it('leaves Payload validation and unrelated error responses alone', async () => {
    expect(
      await hook()({ error: new APIError('Other error', 400), result: { errors: [] } } as never),
    ).toBeUndefined()
    expect(
      await hook()({
        error: new ValidationError({
          collection: 'media',
          errors: [{ path: 'alt', message: 'Alt text is required.' }],
        }),
        result: { errors: [] },
      } as never),
    ).toBeUndefined()
  })
})
