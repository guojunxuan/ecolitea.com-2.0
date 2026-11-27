export const mediaAspectRatios = {
  '1:1': { width: 1, height: 1 },
  '4:3': { width: 4, height: 3 },
  '3:2': { width: 3, height: 2 },
  '16:9': { width: 16, height: 9 },
  '2:1': { width: 2, height: 1 },
} as const

export const mediaAspectRatioOptions = [
  { label: 'Original', value: 'original' },
  ...Object.keys(mediaAspectRatios).map((value) => ({ label: value, value })),
]

export function resolveMediaAspectRatio(value?: string | null) {
  return value && Object.hasOwn(mediaAspectRatios, value)
    ? mediaAspectRatios[value as keyof typeof mediaAspectRatios]
    : undefined
}
