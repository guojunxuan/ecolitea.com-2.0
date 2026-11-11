import type { Endpoint } from 'payload'
import { ValidationError } from 'payload'

import { serverEnv } from '@/utilities/env'
import { getClientIp, hashClientIp } from '@/utilities/quoteRequests/clientIp'
import { isQuoteRateLimited } from '@/utilities/quoteRequests/rateLimit'
import { verifyTurnstileToken } from '@/utilities/quoteRequests/turnstile'
import {
  validateQuoteRequestInput,
  type QuoteFieldErrors,
} from '@/utilities/quoteRequests/validate'
import { publicProductVisibility } from '@/utilities/products/publicVisibility'

type FailureCode = 'validation' | 'verification' | 'rate_limited' | 'server'

const headers = { 'Cache-Control': 'no-store' }
const failure = (status: number, code: FailureCode, fieldErrors?: QuoteFieldErrors) =>
  Response.json({ ok: false, code, ...(fieldErrors ? { fieldErrors } : {}) }, { status, headers })

export const submitQuoteRequestEndpoint: Endpoint = {
  path: '/submit',
  method: 'post',
  handler: async (req) => {
    const secret = serverEnv.TURNSTILE_SECRET_KEY
    const salt = serverEnv.QUOTE_IP_HASH_SALT
    // Unconfigured spam protection must never fall back to accepting submissions.
    if (!secret || !salt) return failure(500, 'server')

    let raw: unknown
    try {
      raw = await req.json?.()
    } catch {
      return failure(400, 'validation')
    }

    const parsed = validateQuoteRequestInput(raw)
    if (!parsed.ok) return failure(400, 'validation', parsed.fieldErrors)
    const { turnstileToken, productSlug, ...fields } = parsed.data

    const ip = getClientIp(req.headers)
    if (!(await verifyTurnstileToken({ token: turnstileToken, secret, ip })))
      return failure(403, 'verification')

    try {
      const ipHash = hashClientIp(ip, salt)
      if (await isQuoteRateLimited(req.payload, ipHash)) return failure(429, 'rate_limited')

      const { docs } = await req.payload.find({
        collection: 'products',
        where: { and: [{ slug: { equals: productSlug } }, publicProductVisibility(new Date())] },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      const product = docs[0]
      if (!product) return failure(400, 'validation', { productSlug: 'Product not found.' })

      await req.payload.create({
        collection: 'quote-requests',
        overrideAccess: true,
        data: {
          ...fields,
          product: product.id,
          productTitle: product.title,
          productSlug: product.slug ?? productSlug,
          status: 'new',
          ipHash,
          userAgent: req.headers.get('user-agent')?.slice(0, 500) || undefined,
        },
      })
      return Response.json({ ok: true }, { headers })
    } catch (error) {
      if (error instanceof ValidationError) {
        const fieldErrors: QuoteFieldErrors = {}
        for (const { path, message } of error.data.errors) {
          if (['name', 'email', 'company', 'message', 'productSlug'].includes(path)) {
            fieldErrors[path as keyof QuoteFieldErrors] = message
          }
        }
        if (Object.keys(fieldErrors).length) return failure(400, 'validation', fieldErrors)
      }
      req.payload.logger.error({ err: error, msg: 'Quote request submission failed' })
      return failure(500, 'server')
    }
  },
}
