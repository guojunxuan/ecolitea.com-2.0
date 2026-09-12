import { describe, expect, it } from 'vitest'
import { MEDIA_UPLOAD_POLICY, validateImageDimensions } from '@/collections/mediaUploadPolicy'

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
