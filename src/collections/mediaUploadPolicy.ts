import { stat } from 'node:fs/promises'

import {
  APIError,
  type CollectionBeforeValidateHook,
  type CollectionBeforeOperationHook,
  type Where,
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
    `Video is ${width}×${height}. Accepted ratios: ${MEDIA_UPLOAD_POLICY.video.ratios.map(({ label }) => label).join(', ')}.`
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

const assertSupportedMediaMimeType = (mimeType?: string): void => {
  if (
    ![...MEDIA_UPLOAD_POLICY.image.mimeTypes, ...MEDIA_UPLOAD_POLICY.video.mimeTypes].includes(
      mimeType as never,
    )
  ) {
    return rejectUpload(
      `Unsupported file type: ${mimeType || 'unknown'}. Media accepts images (${imageTypeNames}) and video (${videoTypeNames}).`,
    )
  }
}

// Local and HTTP upload requests already carry req.file here. Run before
// native file generation so rejected types receive the Media error contract;
// native content/extension checks still run for accepted declared MIME types.
export const validateMediaMimeType: CollectionBeforeOperationHook = ({ operation, req }) => {
  if ((operation === 'create' || operation === 'update') && req.file) {
    assertSupportedMediaMimeType(req.file.mimetype)
  }
}

export const validateMediaUpload: CollectionBeforeValidateHook = async ({ data, req }) => {
  const file = req.file
  if (!file) return withoutSourceMetadata(data)

  const mimeType = file.mimetype || data?.mimeType
  assertSupportedMediaMimeType(mimeType)
  if (mimeType?.startsWith('image/')) {
    const result = validateImageDimensions(data?.width, data?.height)
    if (result !== true) rejectUpload(result)

    return { ...data, durationSeconds: null }
  }

  if (mimeType?.startsWith('video/')) {
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
      metadata = await parseMP4Metadata(
        file.tempFilePath ? { tempFilePath: file.tempFilePath } : file.data,
      )
    } catch (error) {
      return rejectUpload(
        error instanceof Error ? error.message : 'MP4 metadata could not be read.',
      )
    }

    const result = validateVideoMetadata(metadata)
    if (result !== true) rejectUpload(result)

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
