'use client'

import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, CircleAlert } from 'lucide-react'

import { useDictionary } from '@/i18n/DictionaryProvider'
import { trackEvent } from '@/consent/analytics'
import { localizeQuoteError } from '@/i18n/quoteErrors'
import { Media } from '@/components/Media'
import type { ProductDetail } from '@/utilities/products/models'
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

export type QuoteRequestProduct = {
  title: string
  slug: string
  categoryTitle?: string
  thumbnail?: ProductDetail['gallery'][number]
}

const emptyValues: Record<QuoteField, string> = { name: '', email: '', company: '', message: '' }

export function QuoteRequestForm({
  product,
  onSuccess,
}: {
  product: QuoteRequestProduct
  onSuccess: (name: string) => void
}) {
  const { quote: copy } = useDictionary()
  const messages = { ...copy.errors, rate_limited: copy.errors.rateLimited }
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

  const banner =
    !siteKey || widgetFailed ? messages.unavailable : localizeQuoteError(notice, copy.errors)

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
      if (response.ok && result?.ok) {
        trackEvent('quote_submit', { product_slug: product.slug })
        if (active.current) onSuccess(values.name.trim())
        return
      }
      if (!active.current) return
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

  const field = (
    name: QuoteField,
    label: string,
    placeholder: string,
    control: 'input' | 'textarea',
    type?: string,
  ) => {
    const fieldId = `${id}-${name}`
    const error = localizeQuoteError(errors[name], copy.errors)
    const shared = {
      id: fieldId,
      name,
      value: values[name],
      maxLength: QUOTE_LIMITS[name],
      placeholder,
      readOnly: submitting,
      'aria-required': true as const,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': error ? `${fieldId}-error` : undefined,
      onBlur: () => checkField(name),
    }
    return (
      <div className={styles.field}>
        <Label htmlFor={fieldId}>
          {label} <span aria-hidden="true">*</span>
        </Label>
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
        {name === 'message' && (
          <p className={styles.count}>
            {values.message.length} / {QUOTE_LIMITS.message}
          </p>
        )}
      </div>
    )
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.fields}>
        <div className={styles.product}>
          {product.thumbnail && (
            <Media
              className={styles.thumbnail}
              imgClassName={styles.thumbnailImage}
              resource={product.thumbnail}
              fill
              size="48px"
              presentation={{ image: { fit: 'contain' } }}
            />
          )}
          <div className={styles.productText}>
            {product.categoryTitle && <p className={styles.category}>{product.categoryTitle}</p>}
            <p className={styles.productTitle}>{product.title}</p>
          </div>
        </div>
        <div className={styles.row}>
          {field('name', copy.nameLabel, copy.namePlaceholder, 'input', 'text')}
          {field('company', copy.companyLabel, copy.companyPlaceholder, 'input', 'text')}
        </div>
        {field('email', copy.emailLabel, copy.emailPlaceholder, 'input', 'email')}
        {field('message', copy.messageLabel, copy.messagePlaceholder, 'textarea')}
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
            <CircleAlert strokeWidth={1.5} aria-hidden="true" />
            <span>{banner}</span>
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? copy.sending : copy.send}
          {!submitting && <ArrowRight strokeWidth={1.5} aria-hidden="true" />}
        </Button>
        <p className={styles.privacy}>{copy.privacy}</p>
      </div>
    </form>
  )
}
