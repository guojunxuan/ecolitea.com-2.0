import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/collections/parseMP4Metadata', () => ({
  parseMP4Metadata: vi.fn(async () => ({
    audioCodecs: ['mp4a.40.2'],
    durationSeconds: 42,
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

  it('rejects SVG uploads because brand-assets owns SVG resources', async () => {
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
    ).resolves.toEqual({ mimeType: 'video/mp4', durationSeconds: 42 })

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
