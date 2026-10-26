import type { ProductDetail, ProductSpecification } from './models'

type SelectionProduct = Pick<ProductDetail, 'gallery' | 'specifications' | 'options'>

/** Resolve presentation only; never mutate persisted product data or selection. */
export function resolveOptionSelection(
  product: SelectionProduct,
  selection: Record<string, string>,
  changedOptionKey?: string,
): { specifications: ProductSpecification[]; activeImageIndex: number | null } {
  let activeImageIndex: number | null = null
  const specifications = product.specifications.map(({ label, value }) => ({ label, value }))
  const normalize = (label: string) => label.trim().toLowerCase()
  for (const group of product.options) {
    const selected =
      group.values.find((value) => value.key === selection[group.key]) ?? group.values[0]
    if (!selected) continue
    if (
      selected.image &&
      (changedOptionKey === undefined ? activeImageIndex === null : changedOptionKey === group.key)
    ) {
      const index = product.gallery.findIndex(
        (item) => String(item.media.id) === String(selected.image!.id),
      )
      if (index >= 0) activeImageIndex = index
    }
    for (const override of selected.specifications) {
      let matched = false
      specifications.forEach((row, index) => {
        if (normalize(row.label) === normalize(override.label)) {
          specifications[index] = { ...row, value: override.value }
          matched = true
        }
      })
      if (!matched) specifications.push({ label: override.label, value: override.value })
    }
  }
  return { specifications, activeImageIndex }
}

/** A product-only image leaves selection unchanged; shared images synchronize all sources. */
export function selectionForImage(
  product: Pick<ProductDetail, 'gallery'>,
  index: number,
): Record<string, string> {
  if (!Number.isInteger(index)) return {}
  return Object.fromEntries(
    (product.gallery[index]?.values ?? []).map(({ optionKey, valueKey }) => [optionKey, valueKey]),
  )
}
