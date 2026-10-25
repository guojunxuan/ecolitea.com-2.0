import type { Field } from 'payload'
import type { AspectRatio } from '@/components/Media/types'

export const productAspectRatios = {
  '21:9': { width: 21, height: 9 },
  '16:9': { width: 16, height: 9 },
  '4:3': { width: 4, height: 3 },
  '1:1': { width: 1, height: 1 },
  '4:5': { width: 4, height: 5 },
} as const satisfies Record<string, AspectRatio>

export type ProductAspectRatio = keyof typeof productAspectRatios
type ProductAspectRatioValue = ProductAspectRatio | 'original' | 'full-screen'

export function resolveProductAspectRatio(value?: string | null): AspectRatio | undefined {
  return value && Object.hasOwn(productAspectRatios, value)
    ? productAspectRatios[value as ProductAspectRatio]
    : undefined
}

export function productAspectRatioField(options: {
  values: readonly ProductAspectRatioValue[]
  defaultValue: ProductAspectRatioValue
}): Field {
  const label = (value: ProductAspectRatioValue): string => {
    if (value === 'original') return 'Original'
    if (value === 'full-screen') return 'Full Screen'
    if (!Object.hasOwn(productAspectRatios, value)) {
      throw new Error(`Unsupported Product aspect ratio: ${value}`)
    }
    return value
  }
  label(options.defaultValue)
  return {
    name: 'aspectRatio',
    label: 'Aspect Ratio',
    type: 'select',
    required: true,
    defaultValue: options.defaultValue,
    options: options.values.map((value) => ({ label: label(value), value })),
  }
}
