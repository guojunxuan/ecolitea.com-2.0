'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  QUOTE_LIMITS,
  validateQuoteFields,
  type QuoteField,
  type QuoteFieldErrors,
} from '@/utilities/quoteRequests/validate'

import styles from './QuoteRequestForm.module.css'
import { TurnstileWidget } from './TurnstileWidget'

export type QuoteRequestProduct = { title: string; slug: string }

const emptyValues: Record<QuoteField, string> = { name: '', email: '', company: '', message: '' }
const messages = {
  verification: 'Verification failed, please try again.',
  rate_limited: 'Too many requests, please try again later.',
  server: 'Something went wrong. Please try again.',
  needsVerification: 'Please complete the verification before submitting.',
  unavailable: 'Verification is unavailable. Disable content blockers for this page and try again.',
} as const

export function QuoteRequestForm({
  product,
  onSuccess,
}: {
  product: QuoteRequestProduct
  onSuccess: () => void
}) {
  const id = useId()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const [values, setValues] = useState(emptyValues)
  const [errors, setErrors] = useState<QuoteFieldErrors>({})
  const [token, setToken] = useState<string | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [widgetFailed, setWidgetFailed] = useState(false)
  const active = useRef(true)

  // A dismissed form's response must not replace a newly opened form with its confirmation.
  useEffect(() => {
    active.current = true
    return () => {
      active.current = false
    }
  }, [])

  const banner = !siteKey || widgetFailed ? messages.unavailable : notice

  const setField = (field: QuoteField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    if (errors[field]) setErrors((current) => ({ ...current, [field]: undefined }))
  }
  const checkField = (field: QuoteField) => {
    const error = validateQuoteFields(values)[field]
    setErrors((current) => ({ ...current, [field]: error }))
  }
  // Turnstile tokens are single-use, so every server answer requires a fresh challenge.
  const refreshVerification = () => {
    setToken(null)
    setResetKey((key) => key + 1)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    const fieldErrors = validateQuoteFields(values)
    if (Object.keys(fieldErrors).length) {
      setErrors(fieldErrors)
      setNotice(undefined)
      return
    }
    if (!siteKey || widgetFailed) {
      setNotice(messages.unavailable)
      return
    }
    if (!token) {
      setNotice(messages.needsVerification)
      return
    }
    setSubmitting(true)
    setNotice(undefined)
    try {
      const response = await fetch('/api/quote-requests/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, productSlug: product.slug, turnstileToken: token }),
      })
      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        code?: 'validation' | 'verification' | 'rate_limited' | 'server'
        fieldErrors?: QuoteFieldErrors
      } | null
      if (!active.current) return
      if (response.ok && result?.ok) {
        onSuccess()
        return
      }
      refreshVerification()
      if (result?.code === 'validation' && result.fieldErrors) {
        setErrors(result.fieldErrors)
        setNotice(result.fieldErrors.productSlug)
      } else {
        const code = result?.code
        setNotice(
          code === 'verification' || code === 'rate_limited' ? messages[code] : messages.server,
        )
      }
    } catch {
      if (!active.current) return
      refreshVerification()
      setNotice(messages.server)
    } finally {
      if (active.current) setSubmitting(false)
    }
  }

  const field = (name: QuoteField, label: string, control: 'input' | 'textarea', type?: string) => {
    const fieldId = `${id}-${name}`
    const error = errors[name]
    const shared = {
      id: fieldId,
      name,
      value: values[name],
      maxLength: QUOTE_LIMITS[name],
      readOnly: submitting,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${fieldId}-error` : undefined,
      onBlur: () => checkField(name),
    }
    return (
      <div className={styles.field}>
        <Label htmlFor={fieldId}>{label}</Label>
        {control === 'input' ? (
          <Input
            {...shared}
            type={type}
            autoComplete={name === 'name' ? 'name' : name === 'email' ? 'email' : 'organization'}
            onChange={(event) => setField(name, event.target.value)}
          />
        ) : (
          <Textarea {...shared} rows={5} onChange={(event) => setField(name, event.target.value)} />
        )}
        {error && (
          <p id={`${fieldId}-error`} className={styles.error}>
            {error}
          </p>
        )}
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.fields}>
        <p className={styles.product}>{product.title}</p>
        {field('name', 'Name', 'input', 'text')}
        {field('email', 'Email', 'input', 'email')}
        {field('company', 'Company', 'input', 'text')}
        {field('message', 'Message', 'textarea')}
        {siteKey && (
          <TurnstileWidget
            siteKey={siteKey}
            resetKey={resetKey}
            onToken={(value) => {
              setToken(value)
              if (value) setWidgetFailed(false)
            }}
            onUnavailable={() => {
              setToken(null)
              setWidgetFailed(true)
            }}
          />
        )}
      </div>
      <div className={styles.footer}>
        {banner && (
          <p role="alert" className={styles.notice}>
            {banner}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Sending…' : 'Submit request'}
        </Button>
      </div>
    </form>
  )
}
