import { mediaAspectRatioOptions } from '@/components/Media/aspectRatio'

const productAspectRatioOptions = [...mediaAspectRatioOptions, { label: '4:5', value: '4:5' }]

export function getProductAspectRatioOptions(
  values: readonly string[],
): { label: string; value: string }[] {
  return values.map((value) => {
    const option = productAspectRatioOptions.find((candidate) => candidate.value === value)
    if (!option) throw new Error(`Unsupported Product aspect ratio: ${value}`)
    return option
  })
}
