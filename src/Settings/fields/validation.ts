import type { ArrayFieldValidation, FieldHook, TextFieldValidation } from 'payload'
import { validations } from 'payload'

export const trimText: FieldHook = ({ value }) => (typeof value === 'string' ? value.trim() : value)

export const validateEnabledHeading: TextFieldValidation = (value, options) => {
  const defaultResult = validations.text(value, options)
  if (defaultResult !== true) return defaultResult

  const siblingData = options.siblingData as { enabled?: boolean } | undefined
  if (siblingData?.enabled && (typeof value !== 'string' || !value.trim())) {
    return 'Heading is required when the Hero is enabled.'
  }

  return true
}

export const validateArticleSharePlatforms: ArrayFieldValidation = (value, options) => {
  const defaultResult = validations.array(value, options)
  if (defaultResult !== true || !Array.isArray(value)) return defaultResult

  const names = new Map<string, number>()
  for (const [index, row] of value.entries()) {
    if (!row || typeof row !== 'object' || !('name' in row) || typeof row.name !== 'string')
      continue
    const name = row.name.trim().toLowerCase()
    if (!name) continue // The required name field reports empty values.
    const previousRow = names.get(name)
    if (previousRow !== undefined) {
      return `Share platform names in rows ${previousRow} and ${index + 1} must be different.`
    }
    names.set(name, index + 1)
  }
  return true
}
