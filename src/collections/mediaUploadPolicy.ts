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
