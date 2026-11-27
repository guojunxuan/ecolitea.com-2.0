import { stat } from 'node:fs/promises'

import {
  APIError,
  type CollectionAfterErrorHook,
  type CollectionBeforeValidateHook,
  type CollectionBeforeOperationHook,
  type Where,
  type PayloadRequest,
} from 'payload'

import { parseMP4Metadata } from './parseMP4Metadata'

import {
  MEDIA_UPLOAD_POLICY,
  validateImageDimensions,
  imageTypeNames,
} from './mediaUploadPolicy.shared'
export { MEDIA_UPLOAD_POLICY, validateImageDimensions } from './mediaUploadPolicy.shared'

export const imageOnly: Where = { mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] } }
export const imageOrVideo: Where = {
  mimeType: {
    in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes, ...MEDIA_UPLOAD_POLICY.video.mimeTypes],
  },
}
const videoTypeNames = MEDIA_UPLOAD_POLICY.video.mimeTypes
  .map((mime) => ({ 'video/mp4': 'MP4' })[mime])
  .join(', ')
export const mediaUploadDescription = `Images: ${imageTypeNames}; ratios ${MEDIA_UPLOAD_POLICY.image.ratios.map(({ label }) => label).join(', ')} (1% tolerance). Video: ${videoTypeNames}, H.264, AAC or MP3 audio; maximum ${MEDIA_UPLOAD_POLICY.video.maxBytes / 1_000_000} MB and ${MEDIA_UPLOAD_POLICY.video.maxDurationSeconds / 60} minutes; ratios ${MEDIA_UPLOAD_POLICY.video.ratios.map(({ label }) => label).join(', ')} (1% tolerance). Enable Fast Start / Web Optimized when exporting video.`

export const validateVideoDimensions = (width: number, height: number): true | string => {
  const actual = width / height
  return (
    (Number.isFinite(actual) &&
      width > 0 &&
      height > 0 &&
      MEDIA_UPLOAD_POLICY.video.ratios.some(
        (ratio) =>
          actual >= (ratio.width / ratio.height) * (1 - MEDIA_UPLOAD_POLICY.video.ratioTolerance) &&
          actual <= (ratio.width / ratio.height) * (1 + MEDIA_UPLOAD_POLICY.video.ratioTolerance),
      )) ||
    `Video ratio not supported (${width} × ${height}). Use ${MEDIA_UPLOAD_POLICY.video.ratios
      .map(({ label }) => label)
      .join(', ')
      .replace(/, ([^,]+)$/, ' or $1')}.`
  )
}

type VideoMetadata = {
  durationSeconds: number
  videoCodecs: string[]
  audioCodecs: string[]
}

const hasOnlyConfiguredCodecs = (codecs: string[], prefixes: readonly string[]) =>
  codecs.length > 0 &&
  codecs.every((codec) => prefixes.some((prefix) => codec.toLowerCase().startsWith(prefix)))

export const validateVideoMetadata = (metadata: VideoMetadata): true | string => {
  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds <= 0) {
    return "Video can't be read. Try exporting it again."
  }

  if (metadata.durationSeconds > MEDIA_UPLOAD_POLICY.video.maxDurationSeconds) {
    return `Video is too long (${Math.floor(metadata.durationSeconds / 60)}:${String(Math.floor(metadata.durationSeconds % 60)).padStart(2, '0')}). Maximum is 10 minutes.`
  }

  if (
    !hasOnlyConfiguredCodecs(metadata.videoCodecs, MEDIA_UPLOAD_POLICY.video.videoCodecPrefixes)
  ) {
    return 'Video format not supported. Export as MP4 (H.264).'
  }

  if (
    metadata.audioCodecs.length > 0 &&
    !metadata.audioCodecs.every((codec) =>
      MEDIA_UPLOAD_POLICY.video.audioCodecPrefixes.some((prefix) =>
        codec.toLowerCase().startsWith(prefix),
      ),
    )
  ) {
    return 'Audio format not supported. Export with AAC audio.'
  }

  return true
}

const rejectUpload = (message: string): never => {
  throw new APIError(message, 400, { mediaUpload: true })
}

// Payload's field-error toast interprets colons as field separators. Keep
// ratios and timestamps literal using the public REST error response hook.
export const formatMediaUploadError: CollectionAfterErrorHook = ({ error, result }) => {
  if (error instanceof APIError && error.data?.mediaUpload === true && result) {
    return { response: { ...result, message: error.message } }
  }
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

const withoutSourceMetadata = <T extends Record<string, unknown> | undefined>(data: T) => {
  if (!data || !['durationSeconds', 'width', 'height'].some((key) => key in data)) return data

  const { durationSeconds: _durationSeconds, width: _width, height: _height, ...safeData } = data
  return safeData
}

const assertSupportedMediaMimeType = (mimeType?: string, req?: PayloadRequest): void => {
  if (
    ![...MEDIA_UPLOAD_POLICY.image.mimeTypes, ...MEDIA_UPLOAD_POLICY.video.mimeTypes].includes(
      mimeType as never,
    )
  ) {
    req?.payload?.logger?.warn({ mimeType }, 'Unsupported Media upload type')
    return rejectUpload('Unsupported file type. Use JPEG, PNG, WebP, AVIF, GIF or MP4.')
  }
}

// Local and HTTP upload requests already carry req.file here. Run before
// native file generation so rejected types receive the Media error contract;
// native content/extension checks still run for accepted declared MIME types.
export const validateMediaMimeType: CollectionBeforeOperationHook = ({ operation, req }) => {
  if ((operation === 'create' || operation === 'update') && req.file) {
    assertSupportedMediaMimeType(req.file.mimetype, req)
  }
}

export const validateMediaUpload: CollectionBeforeValidateHook = async ({ data, req }) => {
  const file = req.file
  if (!file) return withoutSourceMetadata(data)

  const mimeType = file.mimetype || data?.mimeType
  assertSupportedMediaMimeType(mimeType, req)
  if (mimeType?.startsWith('image/')) {
    const result = validateImageDimensions(data?.width, data?.height)
    if (result !== true) {
      req.payload?.logger?.warn(
        { width: data?.width, height: data?.height },
        'Uploaded image dimensions do not meet Media policy',
      )
      rejectUpload(result)
    }

    return { ...data, durationSeconds: null }
  }

  if (mimeType?.startsWith('video/')) {
    let observedSizes: number[]
    try {
      observedSizes = await getObservedUploadSizes(file, data?.filesize)
    } catch (error) {
      req.payload?.logger?.warn({ err: error }, 'Unable to read uploaded video bytes')
      return rejectUpload("Video can't be read. Try exporting it again.")
    }
    if (observedSizes.some((size) => size > MEDIA_UPLOAD_POLICY.video.maxBytes)) {
      return rejectUpload(
        `Video is too large (${Math.round(Math.max(...observedSizes) / 1_000_000)} MB). Maximum is 100 MB.`,
      )
    }

    let metadata
    try {
      metadata = await parseMP4Metadata(
        file.tempFilePath ? { tempFilePath: file.tempFilePath } : file.data,
      )
    } catch (error) {
      req.payload?.logger?.warn({ err: error }, 'Unable to parse uploaded video')
      return rejectUpload(
        error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'FAST_START_REQUIRED'
          ? "Video isn't web-optimized. Export again with Fast Start on."
          : "Video can't be read. Try exporting it again.",
      )
    }

    const result = validateVideoMetadata(metadata)
    if (result !== true) {
      req.payload?.logger?.warn({ metadata }, 'Uploaded video metadata does not meet Media policy')
      rejectUpload(result)
    }

    const dimensions = validateVideoDimensions(metadata.width, metadata.height)
    if (dimensions !== true) rejectUpload(dimensions)
    return {
      ...data,
      width: metadata.width,
      height: metadata.height,
      durationSeconds: metadata.durationSeconds,
    }
  }

  return { ...data, durationSeconds: null }
}
