import { createFile } from 'mp4box'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  MEDIA_UPLOAD_POLICY,
  validateImageDimensions,
  validateVideoMetadata,
  validateVideoDimensions,
} from '@/collections/mediaUploadPolicy'
import { parseMP4Metadata, parseMP4MetadataWithFactory } from '@/collections/parseMP4Metadata'

type FakeMP4Info = {
  duration: number
  timescale: number
  videoTracks: Array<{
    codec: string
    video?: { width: number; height: number }
    matrix?: ArrayLike<number>
  }>
  audioTracks: Array<{ codec: string }>
}

const atom = (type: string, payload = Buffer.alloc(0)) => {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(payload.length + 8)
  head.write(type, 4)
  return Buffer.concat([head, payload])
}
const validInput = atom('moov')

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
    expect(validateImageDimensions(1011, 1000)).toMatch(/ratio not supported/)
  })

  it('rejects missing, non-positive, and non-finite dimensions', () => {
    expect(validateImageDimensions()).toMatch(/Image can't be read/)
    expect(validateImageDimensions(0, 100)).toMatch(/Image can't be read/)
    expect(validateImageDimensions(-1, 100)).toMatch(/Image can't be read/)
    expect(validateImageDimensions(Number.NaN, 100)).toMatch(/Image can't be read/)
    expect(validateImageDimensions(Number.POSITIVE_INFINITY, 100)).toMatch(/Image can't be read/)
  })

  it('keeps video upload policy values configured for downstream validation', () => {
    expect(MEDIA_UPLOAD_POLICY.video).toEqual({
      ratios: MEDIA_UPLOAD_POLICY.video.ratios,
      ratioTolerance: 0.01,
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
      videoTracks: [{ video: { width: 1920, height: 1080 }, codec: 'AVC1.640028' }],
      audioTracks: [{ codec: 'MP4A.40.2' }],
    })

    await expect(parseMP4MetadataWithFactory(validInput, fake.createFile)).resolves.toEqual({
      width: 1920,
      height: 1080,
      durationSeconds: 90,
      videoCodecs: ['avc1.640028'],
      audioCodecs: ['mp4a.40.2'],
    })
  })

  it('passes the exact buffer slice to MP4Box at file offset zero', async () => {
    const fake = createFakeFile({
      duration: 1,
      timescale: 1,
      videoTracks: [{ video: { width: 1920, height: 1080 }, codec: 'avc1.640028' }],
      audioTracks: [],
    })
    const source = Buffer.concat([Buffer.from([9]), validInput, Buffer.from([8])])
    const input = source.subarray(1, -1)
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

    expect(Array.from(new Uint8Array(received!))).toEqual(Array.from(validInput))
    expect(received?.fileStart).toBe(0)
  })

  it('rejects parser callback errors', async () => {
    await expect(
      parseMP4MetadataWithFactory(validInput, () => ({
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
    [
      {
        duration: 0,
        timescale: 1,
        videoTracks: [{ video: { width: 1920, height: 1080 }, codec: 'avc1' }],
        audioTracks: [],
      },
    ],
    [
      {
        duration: 1,
        timescale: 0,
        videoTracks: [{ video: { width: 1920, height: 1080 }, codec: 'avc1' }],
        audioTracks: [],
      },
    ],
    [
      {
        duration: 1,
        timescale: Number.POSITIVE_INFINITY,
        videoTracks: [{ video: { width: 1920, height: 1080 }, codec: 'avc1' }],
        audioTracks: [],
      },
    ],
    [
      {
        duration: Number.NaN,
        timescale: 1,
        videoTracks: [{ video: { width: 1920, height: 1080 }, codec: 'avc1' }],
        audioTracks: [],
      },
    ],
    [{ duration: 1, timescale: 1, videoTracks: [], audioTracks: [] }],
  ])('rejects malformed movie metadata %#', async (info) => {
    const fake = createFakeFile(info)
    await expect(parseMP4MetadataWithFactory(validInput, fake.createFile)).rejects.toThrow(
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
    ).toMatch(/Video can't be read/)
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

  it.each([['hvc1.1.6.L93.B0', 'avc1.640028'], ['avc1.640028', 'hev1'], []])(
    'rejects unsupported or missing video tracks: %j',
    (...videoCodecs) => {
      expect(validateVideoMetadata({ durationSeconds: 10, videoCodecs, audioCodecs: [] })).toBe(
        'Video format not supported. Export as MP4 (H.264).',
      )
    },
  )
  it('accepts multiple supported H.264 tracks', () => {
    expect(
      validateVideoMetadata({
        durationSeconds: 10,
        videoCodecs: ['avc1.640028', 'avc3.640028'],
        audioCodecs: [],
      }),
    ).toBe(true)
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

describe('MP4 streaming and display dimensions', () => {
  const info = {
    duration: 1,
    timescale: 1,
    videoTracks: [{ codec: 'avc1', video: { width: 1920, height: 1080 } }],
    audioTracks: [],
  }
  it.each([90, 270])('accounts for %s degree rotation', async (rotation) => {
    const matrix =
      rotation === 90
        ? [0, 65536, 0, -65536, 0, 0, 0, 0, 1073741824]
        : [0, -65536, 0, 65536, 0, 0, 0, 0, 1073741824]
    await expect(
      parseMP4MetadataWithFactory(
        validInput,
        createFakeFile({ ...info, videoTracks: [{ ...info.videoTracks[0], matrix }] }).createFile,
      ),
    ).resolves.toMatchObject({ width: 1080, height: 1920 })
  })
  it('rejects moov after mdat with the prescribed faststart guidance', async () => {
    await expect(
      parseMP4MetadataWithFactory(
        Buffer.concat([atom('mdat'), validInput]),
        createFakeFile(info).createFile,
      ),
    ).rejects.toThrow(
      'Video is not optimized for web streaming (moov atom at end of file). Re-export with "Fast Start" / "Web Optimized" enabled, or run: ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4',
    )
  })
  it('reads 1 MB chunks across atom boundaries and stops at moov', async () => {
    const starts: number[] = []
    const sizes: number[] = []
    const fake = createFakeFile(info)
    const input = Buffer.concat([
      atom('free', Buffer.alloc(1024 * 1024 - 12)),
      atom('moov', Buffer.alloc(16)),
      atom('mdat', Buffer.alloc(2 * 1024 * 1024)),
    ])
    await parseMP4MetadataWithFactory(input, () => {
      const file = fake.createFile()
      file.appendBuffer = (chunk) => {
        starts.push(chunk.fileStart!)
        sizes.push(chunk.byteLength)
      }
      return file
    })
    expect(starts).toEqual([0, 1024 * 1024])
    expect(Math.max(...sizes)).toBeLessThanOrEqual(1024 * 1024)
  })
  it.each([
    Buffer.from([0, 0, 0, 4, 109, 111, 111, 118]),
    Buffer.from([0, 0, 0, 30, 109, 111, 111, 118]),
  ])('rejects malformed atom lengths', async (input) => {
    await expect(
      parseMP4MetadataWithFactory(input, createFakeFile(info).createFile),
    ).rejects.toThrow(/MP4/)
  })
  it.each([
    [16, 9],
    [9, 16],
    [1, 1],
    [4, 5],
  ])('bounds the %s:%s video ratio at 1 percent', (width, height) => {
    expect(validateVideoDimensions(width * 1000 * 1.01, height * 1000)).toBe(true)
    expect(validateVideoDimensions(width * 1000 * 1.011, height * 1000)).toMatch(
      /ratio not supported/,
    )
    expect(validateVideoDimensions(width * 1000 * 0.99, height * 1000)).toBe(true)
    expect(validateVideoDimensions(width * 1000 * 0.989, height * 1000)).toMatch(
      /ratio not supported/,
    )
  })
})

describe('real MP4 metadata fixtures', () => {
  const fixture = () => {
    const file = createFile()
    file.addTrack({ width: 1920, height: 1080, timescale: 1000, duration: 1000 })
    return Buffer.from(file.getBuffer().buffer)
  }
  it('reads a generated binary MP4 with the real MP4Box parser', async () => {
    await expect(parseMP4Metadata(fixture())).resolves.toMatchObject({
      width: 1920,
      height: 1080,
      durationSeconds: 1,
      videoCodecs: ['avc1'],
    })
  })
  it.each([90, 270])('reads %s degree rotation from a binary track matrix', async (rotation) => {
    const file = createFile()
    file.addTrack({ width: 1920, height: 1080, duration: 1000, timescale: 1000 })
    file.moov!.traks[0].tkhd.matrix = new Int32Array(
      rotation === 90
        ? [0, 65536, 0, -65536, 0, 0, 0, 0, 1073741824]
        : [0, -65536, 0, 65536, 0, 0, 0, 0, 1073741824],
    )
    await expect(parseMP4Metadata(Buffer.from(file.getBuffer().buffer))).resolves.toMatchObject({
      width: 1080,
      height: 1920,
    })
  })
  it('rejects binary MP4 files without a video track', async () => {
    const file = createFile().init({ duration: 1000, timescale: 1000 })
    await expect(parseMP4Metadata(Buffer.from(file.getBuffer().buffer))).rejects.toThrow(
      /video track/,
    )
  })
  it('rejects oversized extended atom lengths', async () => {
    const header = Buffer.alloc(16)
    header.writeUInt32BE(1)
    header.write('moov', 4)
    header.writeBigUInt64BE(BigInt(Number.MAX_SAFE_INTEGER) + 1n, 8)
    await expect(parseMP4Metadata(header)).rejects.toThrow(/atom length/)
  })
  it('parses temporary files without loading the whole upload', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'media-mp4-'))
    try {
      const tempFilePath = path.join(directory, 'video.mp4')
      await writeFile(
        tempFilePath,
        Buffer.concat([fixture(), atom('mdat', Buffer.alloc(2 * 1024 * 1024))]),
      )
      await expect(parseMP4Metadata({ tempFilePath })).resolves.toMatchObject({
        width: 1920,
        height: 1080,
        durationSeconds: 1,
      })
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
})

describe('editor-facing upload policy messages', () => {
  it('reports image dimensions and all supported ratios', () => {
    expect(validateImageDimensions(1000, 210)).toBe(
      'Image ratio not supported (1000 × 210). Use 1:1, 4:3, 3:2, 16:9, 9:16 or 4:5.',
    )
    expect(validateImageDimensions()).toBe("Image can't be read. Try another file.")
  })
  it('reports video dimensions and supported ratios', () => {
    expect(validateVideoDimensions(1440, 1080)).toBe(
      'Video ratio not supported (1440 × 1080). Use 16:9, 9:16, 1:1 or 4:5.',
    )
  })
  it('formats actual duration as m:ss', () => {
    expect(
      validateVideoMetadata({ durationSeconds: 750, videoCodecs: ['avc1'], audioCodecs: [] }),
    ).toBe('Video is too long (12:30). Maximum is 10 minutes.')
  })
  it('gives export guidance without displaying codec identifiers', () => {
    expect(
      validateVideoMetadata({ durationSeconds: 10, videoCodecs: ['hev1'], audioCodecs: [] }),
    ).toBe('Video format not supported. Export as MP4 (H.264).')
    expect(
      validateVideoMetadata({ durationSeconds: 10, videoCodecs: ['avc1'], audioCodecs: ['opus'] }),
    ).toBe('Audio format not supported. Export with AAC audio.')
  })
})
