import { readFile, stat } from 'node:fs/promises'

import { APIError, type CollectionBeforeValidateHook } from 'payload'

import { parseMP4Metadata } from './parseMP4Metadata'

export const MEDIA_UPLOAD_POLICY = {
  image: {
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'],
    ratios: [
      { label: '1:1', width: 1, height: 1 },
      { label: '4:3', width: 4, height: 3 },
      { label: '3:2', width: 3, height: 2 },
      { label: '16:9', width: 16, height: 9 },
      { label: '9:16', width: 9, height: 16 },
      { label: '4:5', width: 4, height: 5 },
    ],
    ratioTolerance: 0.01,
  },
  video: {
    maxBytes: 100_000_000,
    maxDurationSeconds: 10 * 60,
    mimeTypes: ['video/mp4'],
    videoCodecPrefixes: ['avc1', 'avc3'],
    audioCodecPrefixes: ['mp4a.40.', 'mp4a.69', 'mp4a.6a', 'mp4a.6b', 'mp3', '.mp3'],
  },
} as const

export const validateImageDimensions = (
  width?: number | null,
  height?: number | null,
): true | string => {
  if (
    width == null ||
    height == null ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return 'Image dimensions could not be read.'
  }

  const actualRatio = width / height
  const tolerance = MEDIA_UPLOAD_POLICY.image.ratioTolerance
  const matched = MEDIA_UPLOAD_POLICY.image.ratios.some(
    ({ width: ratioWidth, height: ratioHeight }) => {
      const expectedRatio = ratioWidth / ratioHeight
      return (
        actualRatio >= expectedRatio * (1 - tolerance) &&
        actualRatio <= expectedRatio * (1 + tolerance)
      )
    },
  )

  return (
    matched ||
    `Image is ${width}×${height}. Accepted ratios: ${MEDIA_UPLOAD_POLICY.image.ratios
      .map(({ label }) => label)
      .join(', ')}.`
  )
}

type VideoMetadata = {
  durationSeconds: number
  videoCodecs: string[]
  audioCodecs: string[]
}

const hasConfiguredCodec = (codecs: string[], prefixes: readonly string[]) =>
  codecs.some((codec) => prefixes.some((prefix) => codec.toLowerCase().startsWith(prefix)))

export const validateVideoMetadata = (metadata: VideoMetadata): true | string => {
  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0) {
    return 'Video duration could not be read.'
  }

  if (metadata.durationSeconds > MEDIA_UPLOAD_POLICY.video.maxDurationSeconds) {
    return 'Video duration exceeds the maximum of 10 minutes.'
  }

  if (!hasConfiguredCodec(metadata.videoCodecs, MEDIA_UPLOAD_POLICY.video.videoCodecPrefixes)) {
    return 'Video must use an H.264 (AVC) video codec.'
  }

  if (
    metadata.audioCodecs.length > 0 &&
    !metadata.audioCodecs.every((codec) =>
      MEDIA_UPLOAD_POLICY.video.audioCodecPrefixes.some((prefix) =>
        codec.toLowerCase().startsWith(prefix),
      ),
    )
  ) {
    return 'Video audio must use an AAC or MP3 codec.'
  }

  return true
}

const rejectUpload = (message: string): never => {
  throw new APIError(message, 400)
}

const readUploadedFile = async (file: {
  data?: Buffer
  tempFilePath?: string
}): Promise<Buffer> => {
  if (file.tempFilePath) return readFile(file.tempFilePath)
  if (Buffer.isBuffer(file.data)) return file.data

  return rejectUpload('Uploaded video bytes could not be read.')
}

const getObservedUploadSizes = async (
  file: { data?: Buffer; size?: number; tempFilePath?: string },
  generatedFilesize?: number | null,
): Promise<number[]> => {
  const sizes = [file.size, generatedFilesize, file.data?.byteLength].filter(
    (size): size is number => typeof size === 'number' && Number.isFinite(size),
  )

  if (file.tempFilePath) sizes.push((await stat(file.tempFilePath)).size)

  return sizes
}

const withoutDurationSeconds = <T extends Record<string, unknown> | undefined>(data: T) => {
  if (!data || !('durationSeconds' in data)) return data

  const { durationSeconds: _durationSeconds, ...safeData } = data
  return safeData
}

export const validateMediaUpload: CollectionBeforeValidateHook = async ({ data, req }) => {
  const file = req.file
  if (!file) return withoutDurationSeconds(data)

  const mimeType = file.mimetype || data?.mimeType
  if (mimeType?.startsWith('image/')) {
    if (!(MEDIA_UPLOAD_POLICY.image.mimeTypes as readonly string[]).includes(mimeType)) {
      return rejectUpload(
        mimeType === 'image/svg+xml'
          ? 'SVG files belong in Brand Assets, not Media.'
          : 'Image file type is not supported.',
      )
    }

    const result = validateImageDimensions(data?.width, data?.height)
    if (result !== true) rejectUpload(result)

    return { ...data, durationSeconds: null }
  }

  if (mimeType?.startsWith('video/')) {
    if (!MEDIA_UPLOAD_POLICY.video.mimeTypes.includes(mimeType as 'video/mp4')) {
      return rejectUpload('Video must use the MP4 container (video/mp4).')
    }

    let observedSizes: number[]
    try {
      observedSizes = await getObservedUploadSizes(file, data?.filesize)
    } catch (error) {
      return rejectUpload(
        error instanceof Error ? error.message : 'Uploaded video bytes could not be read.',
      )
    }
    if (observedSizes.some((size) => size > MEDIA_UPLOAD_POLICY.video.maxBytes)) {
      return rejectUpload('Video file size exceeds the maximum of 100 MB.')
    }

    let metadata
    try {
      metadata = await parseMP4Metadata(await readUploadedFile(file))
    } catch (error) {
      return rejectUpload(
        error instanceof Error ? error.message : 'MP4 metadata could not be read.',
      )
    }

    const result = validateVideoMetadata(metadata)
    if (result !== true) rejectUpload(result)

    return { ...data, durationSeconds: metadata.durationSeconds }
  }

  return { ...data, durationSeconds: null }
}
