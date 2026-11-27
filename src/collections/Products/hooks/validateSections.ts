import {
  ValidationError,
  type ArrayFieldValidation,
  type CollectionBeforeValidateHook,
  type ValidationFieldError,
} from 'payload'
import { array } from 'payload/shared'

type Section = { id?: string; label?: string; anchor?: string | null }
const reserved = new Set(['overview', 'related-products'])
const sectionAnchor = (label: string) =>
  label
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

function resolveAnchors(rows: Section[], previous: Section[]) {
  const effective = rows.map((row) => ({
    ...previous.find((old) => row.id && old.id === row.id),
    ...row,
  }))
  const anchors = effective.map(({ anchor, label }) =>
    anchor?.trim() ? anchor : sectionAnchor(label ?? ''),
  )
  const taken = new Set([...reserved, ...anchors])
  return anchors.map((anchor, index) => {
    if (anchor || !effective[index].label?.trim()) return anchor
    const base = `section-${index + 1}`
    let fallback = base
    let suffix = 2
    while (taken.has(fallback)) fallback = `${base}-${suffix++}`
    taken.add(fallback)
    return fallback
  })
}

export const generateSectionAnchors: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!Array.isArray(data?.sections)) return data
  const sections: Section[] = data.sections
  const anchors = resolveAnchors(sections, originalDoc?.sections ?? [])
  return { ...data, sections: sections.map((row, index) => ({ ...row, anchor: anchors[index] })) }
}

export const validateSections: ArrayFieldValidation = (value, options) => {
  const { previousValue, data, event, req } = options
  const incoming = (
    event === 'onChange' || value === undefined
      ? (data as { sections?: Section[] | null }).sections
      : value
  ) as Section[] | null | undefined
  const previous: Section[] = Array.isArray(previousValue) ? (previousValue as Section[]) : []
  const rows: Section[] = incoming === undefined ? previous : (incoming ?? [])
  const lengthResult = array(rows, options)
  if (lengthResult !== true) return lengthResult
  const anchors = new Set<string>()
  const errors: ValidationFieldError[] = []
  resolveAnchors(rows, previous).forEach((anchor, index) => {
    let message: string | undefined
    if (!/^[a-z][a-z0-9-]*$/.test(anchor))
      message = 'Start with a lowercase letter and use only lowercase letters, numbers and hyphens.'
    else if (reserved.has(anchor)) message = 'This anchor is reserved for a fixed product section.'
    else if (anchors.has(anchor)) message = 'Use a unique section anchor.'
    if (message) errors.push({ path: `sections.${index}.anchor`, message })
    anchors.add(anchor)
  })
  if (errors.length) {
    if (event === 'onChange') return `${errors[0].path}: ${errors[0].message}`
    throw new ValidationError({ collection: 'products', errors, req })
  }
  return true
}
