type SubmissionField = {
  blockType: string
  name?: string
  required?: boolean | null
}

type SubmissionValue = { field: string; value?: unknown }

export const isEmptySubmissionValue = (value: unknown): boolean =>
  value == null || (typeof value === 'string' && value.trim() === '')

/** Preserve required entries for validation and meaningful values such as 0 and false. */
export function normalizeSubmissionData<T extends SubmissionValue>(
  rows: T[],
  fields: SubmissionField[],
): T[] {
  const optionalNames = new Set(
    fields.filter((field) => field.name && !field.required).map((field) => field.name),
  )
  return rows.filter((row) => !optionalNames.has(row?.field) || !isEmptySubmissionValue(row.value))
}
