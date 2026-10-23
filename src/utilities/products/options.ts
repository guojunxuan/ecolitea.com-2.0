import type { Media } from '@/payload-types'
import type { ProductDetail, ProductSpecification } from './models'

/** Resolve presentation only; never mutate persisted product data or selection. */
export function resolveOptionSelection(
  product: Pick<ProductDetail, 'gallery' | 'specifications' | 'options'>,
  selection: Record<string, string>,
): { gallery: Media[]; specifications: ProductSpecification[] } {
  let gallery: Media[] | undefined
  const specifications = product.specifications.map((row) => ({ ...row }))
  const normalize = (label: string) => label.trim().toLowerCase()
  for (const group of product.options) {
    const selected =
      group.values.find((value) => value.key === selection[group.key]) ?? group.values[0]
    if (!selected) continue
    if (!gallery && selected.gallery.length) gallery = [...selected.gallery]
    for (const override of selected.specifications) {
      let matched = false
      specifications.forEach((row, index) => {
        if (normalize(row.label) === normalize(override.label)) {
          specifications[index] = { ...row, value: override.value }
          matched = true
        }
      })
      if (!matched) specifications.push({ group: '', label: override.label, value: override.value })
    }
  }
  return { gallery: gallery ?? [...product.gallery], specifications }
}
