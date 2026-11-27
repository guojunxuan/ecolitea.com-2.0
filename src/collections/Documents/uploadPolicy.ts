export const DOCUMENT_UPLOAD_POLICY = {
  maxBytes: 10_000_000,
  types: {
    pdf: { mimeType: 'application/pdf', label: 'PDF' },
    docx: {
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      label: 'Word',
    },
    xlsx: {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      label: 'Excel',
    },
    pptx: {
      mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      label: 'PowerPoint',
    },
  },
} as const

export const documentUploadDescription = `Documents: ${Object.entries(DOCUMENT_UPLOAD_POLICY.types)
  .map(([extension, { label }]) => `${label} (.${extension})`)
  .join(
    ', ',
  )}; maximum ${DOCUMENT_UPLOAD_POLICY.maxBytes / 1_000_000} MB. Legacy Office formats and documents with macros are not allowed.`
