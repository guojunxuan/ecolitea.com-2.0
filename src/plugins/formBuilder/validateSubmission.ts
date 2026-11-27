import { ValidationError, type CollectionBeforeValidateHook } from 'payload'
import type { FormSubmission } from '@/payload-types'
import { isEmptySubmissionValue, normalizeSubmissionData } from './submissionData'

/** The installed plugin validates row values, but not the form's required fields. */
export const validateSubmission: CollectionBeforeValidateHook<FormSubmission> = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data
  const relationship = data.form ?? originalDoc?.form
  const id = typeof relationship === 'object' ? relationship?.id : relationship
  // Leave malformed/missing relationships to the plugin's native validator.
  if (!id) return data
  const form = await req.payload.findByID({
    collection: 'forms',
    id,
    depth: 0,
    select: { fields: true },
    overrideAccess: false,
    req,
  })
  const fields = form.fields ?? []
  const rows = data.submissionData ?? originalDoc?.submissionData ?? []
  if (!Array.isArray(rows)) return data

  const errors = fields.flatMap((field) => {
    if (!('name' in field) || !field.required) return []
    const index = rows.findIndex((row) => row?.field === field.name)
    const value: unknown = rows[index]?.value
    const missing =
      field.blockType === 'checkbox'
        ? value !== true && value !== 'true'
        : isEmptySubmissionValue(value)
    return missing
      ? [
          {
            path: index < 0 ? 'submissionData' : `submissionData.${index}.value`,
            message: `${field.label || field.name} is required.`,
          },
        ]
      : []
  })
  if (errors.length) throw new ValidationError({ collection: 'form-submissions', errors, req })

  return { ...data, submissionData: normalizeSubmissionData(rows, fields) }
}
