import { describe, expect, it } from 'vitest'
import {
  MEDIA_UPLOAD_POLICY,
  validateImageDimensions,
  validateVideoMetadata,
} from '@/collections/mediaUploadPolicy'
import {
  parseMP4Metadata,
  parseMP4MetadataWithFactory,
} from '@/collections/parseMP4Metadata'

type FakeMP4Info = {
  duration: number
  timescale: number
  videoTracks: Array<{ codec: string }>
  audioTracks: Array<{ codec: string }>
}

const createFakeFile = (info: FakeMP4Info) => {
  let file: {
    onReady?: (metadata: FakeMP4Info) => void
    onError?: (module: string, message: string) => void
    appendBuffer: (buffer: ArrayBuffer & { fileStart?: number }) => void
    flush: () => void
  }

  return {
    createFile: () => {
      file = {
        appendBuffer: () => undefined,
        flush: () => file.onReady?.(info),
      }
      return file
    },
  }
}

describe('Media image upload policy', () => {
  it.each([
    [1000, 1000],
    [1600, 1200],
    [1500, 1000],
    [1920, 1080],
    [1080, 1920],
    [1200, 1500],
  ])('accepts configured dimensions %sx%s', (width, height) =>
    expect(validateImageDimensions(width, height)).toBe(true),
  )

  it('uses an inclusive 1 percent relative tolerance', () => {
    expect(MEDIA_UPLOAD_POLICY.image.ratioTolerance).toBe(0.01)
    expect(validateImageDimensions(1010, 1000)).toBe(true)
    expect(validateImageDimensions(1011, 1000)).toMatch(/Accepted ratios/)
  })

  it('rejects missing, non-positive, and non-finite dimensions', () => {
    expect(validateImageDimensions()).toMatch(/dimensions/)
    expect(validateImageDimensions(0, 100)).toMatch(/dimensions/)
    expect(validateImageDimensions(-1, 100)).toMatch(/dimensions/)
    expect(validateImageDimensions(Number.NaN, 100)).toMatch(/dimensions/)
    expect(validateImageDimensions(Number.POSITIVE_INFINITY, 100)).toMatch(/dimensions/)
  })

  it('keeps video upload policy values configured for downstream validation', () => {
    expect(MEDIA_UPLOAD_POLICY.video).toEqual({
      maxBytes: 100_000_000,
      maxDurationSeconds: 10 * 60,
      mimeTypes: ['video/mp4'],
      videoCodecPrefixes: ['avc1', 'avc3'],
      audioCodecPrefixes: ['mp4a.40.', 'mp4a.69', 'mp4a.6a', 'mp4a.6b', 'mp3', '.mp3'],
    })
  })
})

describe('MP4 metadata parsing', () => {
  it('normalizes movie duration from the MP4 timescale and codecs', async () => {
    const fake = createFakeFile({
      duration: 90_000,
      timescale: 1_000,
      videoTracks: [{ codec: 'AVC1.640028' }],
      audioTracks: [{ codec: 'MP4A.40.2' }],
    })

    await expect(
      parseMP4MetadataWithFactory(Buffer.from([1, 2, 3]), fake.createFile),
    ).resolves.toEqual({
      durationSeconds: 90,
      videoCodecs: ['avc1.640028'],
      audioCodecs: ['mp4a.40.2'],
    })
  })

  it('passes the exact buffer slice to MP4Box at file offset zero', async () => {
    const fake = createFakeFile({
      duration: 1,
      timescale: 1,
      videoTracks: [{ codec: 'avc1.640028' }],
      audioTracks: [],
    })
    const source = new Uint8Array([9, 1, 2, 3, 8])
    const input = Buffer.from(source.buffer, 1, 3)
    let received: (ArrayBuffer & { fileStart?: number }) | undefined
    const originalCreateFile = fake.createFile
    fake.createFile = () => {
      const file = originalCreateFile()
      const appendBuffer = file.appendBuffer
      file.appendBuffer = (buffer) => {
        received = buffer
        appendBuffer(buffer)
      }
      return file
    }

    await parseMP4MetadataWithFactory(input, fake.createFile)

    expect(Array.from(new Uint8Array(received!))).toEqual([1, 2, 3])
    expect(received?.fileStart).toBe(0)
  })

  it('rejects parser callback errors', async () => {
    await expect(
      parseMP4MetadataWithFactory(Buffer.from([1]), () => ({
        appendBuffer: () => undefined,
        flush: function () {
          this.onError?.('ISOFile', 'broken atom')
        },
      })),
    ).rejects.toThrow(/broken atom/)
  })

  it('rejects incomplete binary MP4 data from the real parser', async () => {
    await expect(parseMP4Metadata(Buffer.from('not an mp4'))).rejects.toThrow(/metadata|MP4/i)
  })

  it.each([
    [{ duration: 0, timescale: 1, videoTracks: [{ codec: 'avc1' }], audioTracks: [] }],
    [{ duration: 1, timescale: 0, videoTracks: [{ codec: 'avc1' }], audioTracks: [] }],
    [
      {
        duration: 1,
        timescale: Number.POSITIVE_INFINITY,
        videoTracks: [{ codec: 'avc1' }],
        audioTracks: [],
      },
    ],
    [{ duration: Number.NaN, timescale: 1, videoTracks: [{ codec: 'avc1' }], audioTracks: [] }],
    [{ duration: 1, timescale: 1, videoTracks: [], audioTracks: [] }],
  ])('rejects malformed movie metadata %#', async (info) => {
    const fake = createFakeFile(info)
    await expect(parseMP4MetadataWithFactory(Buffer.from([1]), fake.createFile)).rejects.toThrow(
      /metadata|video track/i,
    )
  })
})

describe('Media video upload policy', () => {
  it('accepts configured H.264 video and AAC audio within ten minutes', () => {
    expect(
      validateVideoMetadata({
        durationSeconds: 599,
        audioCodecs: ['mp4a.40.2'],
        videoCodecs: ['avc1.640028'],
      }),
    ).toBe(true)
  })

  it('rejects videos longer than ten minutes', () => {
    expect(
      validateVideoMetadata({
        durationSeconds: 601,
        audioCodecs: ['mp4a.40.2'],
        videoCodecs: ['avc1.640028'],
      }),
    ).toMatch(/10 minutes/)
  })

  it('rejects zero duration metadata', () => {
    expect(
      validateVideoMetadata({
        durationSeconds: 0,
        audioCodecs: ['mp4a.40.2'],
        videoCodecs: ['avc1.640028'],
      }),
    ).toMatch(/duration/i)
  })

  it('requires H.264 video rather than accepting arbitrary MP4 codecs', () => {
    expect(
      validateVideoMetadata({
        durationSeconds: 20,
        audioCodecs: ['opus'],
        videoCodecs: ['hev1'],
      }),
    ).toMatch(/H.264/)
  })

  it('rejects generic MP4 audio identifiers and accepts videos without audio', () => {
    expect(
      validateVideoMetadata({
        durationSeconds: 20,
        audioCodecs: ['mp4a.99'],
        videoCodecs: ['avc3.640028'],
      }),
    ).toMatch(/audio/i)
    expect(
      validateVideoMetadata({
        durationSeconds: 20,
        audioCodecs: [],
        videoCodecs: ['avc3.640028'],
      }),
    ).toBe(true)
  })
})
