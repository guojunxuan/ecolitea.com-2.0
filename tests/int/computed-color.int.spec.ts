import { describe, expect, it } from 'vitest'

import { normalizeComputedColor } from '../helpers/computedColor'

describe('computed CSS color normalization', () => {
  it.each([
    ['rgb(255, 255, 255)', [255, 255, 255, 1]],
    ['rgba(10, 20, 30, 0.25)', [10, 20, 30, 0.25]],
    ['rgba(100%, 50%, 0%, 50%)', [255, 128, 0, 0.5]],
    ['rgb(0 0 0 / 50%)', [0, 0, 0, 0.5]],
    ['transparent', [0, 0, 0, 0]],
    ['oklch(1 0 0)', [255, 255, 255, 1]],
    ['oklch(100% 0 0deg / 25%)', [255, 255, 255, 0.25]],
    ['color(srgb 1 1 1 / 0.75)', [255, 255, 255, 0.75]],
  ])('normalizes %s to sRGB channels', (source, expected) => {
    expect(normalizeComputedColor(source)).toEqual(expected)
  })
})
