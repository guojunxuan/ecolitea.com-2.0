export const QUOTE_LIMITS = { name: 100, email: 254, company: 150, message: 2000 } as const

export type QuoteField = 'name' | 'email' | 'company' | 'message'
export type QuoteFieldErrors = Partial<Record<QuoteField | 'productSlug', string>>

export type QuoteRequestInput = {
  name: string
  email: string
  company: string
  message: string
  productSlug: string
  turnstileToken: string
}

export type QuoteValidation =
  { ok: true; data: QuoteRequestInput } | { ok: false; fieldErrors: QuoteFieldErrors }

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const labels: Record<QuoteField, string> = {
  name: 'Name',
  email: 'Email',
  company: 'Company',
  message: 'Message',
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '')

/** Validates the four user-entered fields; shared by the form (feedback) and the endpoint. */
export function validateQuoteFields(
  values: Partial<Record<QuoteField, unknown>>,
): QuoteFieldErrors {
  const errors: QuoteFieldErrors = {}
  for (const field of Object.keys(labels) as QuoteField[]) {
    const value = text(values[field])
    if (!value) errors[field] = `${labels[field]} is required.`
    else if (value.length > QUOTE_LIMITS[field])
      errors[field] = `${labels[field]} must be ${QUOTE_LIMITS[field]} characters or fewer.`
  }
  if (!errors.email && !emailPattern.test(text(values.email)))
    errors.email = 'Enter a valid email address.'
  return errors
}

export function validateQuoteRequestInput(raw: unknown): QuoteValidation {
  const input = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const fieldErrors = validateQuoteFields(input)
  const productSlug = text(input.productSlug)
  if (!productSlug) fieldErrors.productSlug = 'Product is required.'
  if (Object.keys(fieldErrors).length) return { ok: false, fieldErrors }
  return {
    ok: true,
    data: {
      name: text(input.name),
      email: text(input.email),
      company: text(input.company),
      message: text(input.message),
      productSlug,
      turnstileToken: typeof input.turnstileToken === 'string' ? input.turnstileToken : '',
    },
  }
}
