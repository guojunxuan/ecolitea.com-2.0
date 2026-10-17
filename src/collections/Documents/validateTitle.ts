import {
  ValidationError,
  validations,
  type CollectionBeforeValidateHook,
  type TextFieldValidation,
} from 'payload'

export const validateTitle: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const changed = data && Object.hasOwn(data, 'title') && data.title !== originalDoc?.title
  if (operation !== 'create' && !req.file && !changed) return data

  const value = data && Object.hasOwn(data, 'title') ? data.title : originalDoc?.title
  const title = (typeof value === 'string' ? value : '').trim()
  let message: string | undefined
  if (!title) message = 'Title is required.'
  else if (/^(?:document|file|pdf|doc|untitled)$/i.test(title)) {
    message = 'Title is too generic. Describe the document.'
  } else if (
    /\.(?:pdf|docx?|xlsx?|pptx?|docm|xlsm|pptm)\b/i.test(title) ||
    /^(?:scan[ _-]*\d.*|document[ _-]*\d+|new document|\d+[\d\s:./_-]*)$/i.test(title)
  ) {
    message = 'Title should describe the document, not repeat the filename.'
  } else if (Array.from(title).length < 3 || Array.from(title).length > 150) {
    message = 'Title should be 3–150 characters.'
  }
  if (message)
    throw new ValidationError({ collection: 'documents', errors: [{ path: 'title', message }] })
  return { ...data, title }
}

// Retain native required validation for writes that change the title, while
// allowing unrelated updates to historical documents with an empty title.
export const validateTitleField: TextFieldValidation = (value, options) => {
  if (
    options.operation === 'update' &&
    !options.req.file &&
    (value === undefined || value === options.previousValue)
  )
    return true
  return validations.text(value, options)
}
