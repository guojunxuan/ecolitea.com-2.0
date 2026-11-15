import { ValidationError, type FieldHook } from 'payload'
import { isLocaleSegment } from '@/i18n/config'

export const validatePageSlug = (value: unknown): string | true =>
  typeof value === 'string' && isLocaleSegment(value)
    ? 'This slug is reserved for a language URL. Use a longer page slug.'
    : true

// Native slug generation runs first. Unlike validate, field hooks also run on
// autosaves/drafts, so inspect the final slug without enabling all draft validation.
export const enforcePageSlug: FieldHook = ({ path, req, value }) => {
  const result = validatePageSlug(value)
  if (result !== true) {
    throw new ValidationError({ errors: [{ path: path.join('.'), message: result }] }, req.t)
  }
  return value
}
