type ColumnRow = {
  label?: string | null
}

type NavItemRow = {
  link?: {
    label?: string | null
    reference?: {
      relationTo?: string
      value?: unknown
    } | null
    url?: string | null
  } | null
}

const numberedFallback = (name: string, rowNumber?: number): string =>
  `${name} ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`

export const getColumnRowLabel = (data?: ColumnRow | null, rowNumber?: number): string =>
  data?.label?.trim() || numberedFallback('Navigation Column', rowNumber)

export const getNavItemRowLabel = (data?: NavItemRow | null, rowNumber?: number): string => {
  const link = data?.link
  const label = link?.label?.trim()
  if (label) return label

  const referenceValue = link?.reference?.value
  if (referenceValue && typeof referenceValue === 'object' && 'title' in referenceValue) {
    const title = (referenceValue as { title?: unknown }).title
    if (typeof title === 'string' && title.trim()) return title.trim()
  }

  return link?.url?.trim() || numberedFallback('Navigation Link', rowNumber)
}
