export const MEDIA_UPLOAD_POLICY = {
  image: {
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
  codecs.some((codec) =>
    prefixes.some((prefix) => codec.toLowerCase().startsWith(prefix)),
  )

export const validateVideoMetadata = (metadata: VideoMetadata): true | string => {
  if (!Number.isFinite(metadata.durationSeconds) || metadata.durationSeconds < 0) {
    return 'Video duration could not be read.'
  }

  if (metadata.durationSeconds > MEDIA_UPLOAD_POLICY.video.maxDurationSeconds) {
    return 'Video duration exceeds the maximum of 10 minutes.'
  }

  if (
    !hasConfiguredCodec(
      metadata.videoCodecs,
      MEDIA_UPLOAD_POLICY.video.videoCodecPrefixes,
    )
  ) {
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
