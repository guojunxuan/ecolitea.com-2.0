import { ValidationError, type ArrayFieldValidation, type ValidationFieldError } from 'payload'
import { optionKey } from '@/utilities/products/keys'

type Value = { id?: string; label?: string; swatch?: string | null; thumbnail?: unknown }
type Group = { id?: string; name?: string; display?: string; values?: Value[] | null }

// Payload replaces source arrays. Resolve omitted row fields by stable row ID,
// while preserving explicit nulls and array removals in the submitted document.
const effectiveRows = <T extends { id?: string }>(rows: T[], previous: T[] = []): T[] =>
  rows.map((row) => ({ ...previous.find((old) => row.id && old.id === row.id), ...row }))

export const validateOptions: ArrayFieldValidation = (value, { previousValue, data, req }) => {
  const incoming = (
    value === undefined ? (data as { options?: Group[] | null }).options : value
  ) as Group[] | null | undefined
  const previous = previousValue as Group[] | null | undefined
  const groups = effectiveRows(
    incoming === undefined ? (previous ?? []) : (incoming ?? []),
    previous ?? [],
  )
  const errors: ValidationFieldError[] = []
  const names = new Set<string>()
  const groupKeys = new Set<string>()
  const unique = (
    name: string | undefined,
    names: Set<string>,
    keys: Set<string>,
    path: string,
  ) => {
    const normalized = (name ?? '').trim().toLowerCase()
    const key = optionKey(name ?? '')
    if (!key || names.has(normalized) || keys.has(key))
      errors.push({ path, message: 'Use a unique name containing letters or numbers.' })
    names.add(normalized)
    keys.add(key)
  }
  groups.forEach((group, groupIndex) => {
    const prefix = `options.${groupIndex}`
    unique(group.name, names, groupKeys, `${prefix}.name`)
    const old = previous?.find((row) => group.id && row.id === group.id)
    const values = effectiveRows(group.values ?? [], old?.values ?? [])
    const labels = new Set<string>()
    const valueKeys = new Set<string>()
    values.forEach((item, valueIndex) => {
      const path = `${prefix}.values.${valueIndex}`
      unique(item.label, labels, valueKeys, `${path}.label`)
      if (group.display === 'swatch' && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(item.swatch ?? ''))
        errors.push({ path: `${path}.swatch`, message: 'Enter a color as #RGB or #RRGGBB.' })
      if (group.display === 'image' && !item.thumbnail)
        errors.push({ path: `${path}.thumbnail`, message: 'Choose an image for this value.' })
    })
  })
  if (errors.length) throw new ValidationError({ collection: 'products', errors, req })
  return true
}
