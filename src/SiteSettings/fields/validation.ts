import type { FieldHook, TextareaFieldValidation, TextFieldValidation } from 'payload'
import { validations } from 'payload'

export const trimText: FieldHook = ({ value }) =>
  typeof value === 'string' ? value.trim() : value

export const validateNonBlankText: TextFieldValidation = (value, options) => {
  const defaultResult = validations.text(value, options)
  if (defaultResult !== true) return defaultResult

  return typeof value === 'string' && value.trim().length > 0
    ? true
    : 'This field is required.'
}

export const validateNonBlankTextarea: TextareaFieldValidation = (value, options) => {
  const defaultResult = validations.textarea(value, options)
  if (defaultResult !== true) return defaultResult

  return typeof value === 'string' && value.trim().length > 0
    ? true
    : 'This field is required.'
}
