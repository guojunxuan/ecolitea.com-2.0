import type { FieldHook, TextFieldValidation } from 'payload'
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
