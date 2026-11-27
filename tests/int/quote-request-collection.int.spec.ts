import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import {
  buildConfig,
  getPayload,
  type Payload,
  type PayloadRequest,
  type RequiredDataFromCollectionSlug,
} from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuoteRequests } from '@/collections/QuoteRequests'
import { submitQuoteRequestEndpoint } from '@/collections/QuoteRequests/endpoints/submit'
import { QUOTE_RATE_LIMIT, isQuoteRateLimited } from '@/utilities/quoteRequests/rateLimit'
import { serverEnv } from '@/utilities/env'
import { hashClientIp } from '@/utilities/quoteRequests/clientIp'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

const salt = 'ci-only-quote-ip-hash-salt'
const originalProtection = {
  secret: serverEnv.TURNSTILE_SECRET_KEY,
  salt: serverEnv.QUOTE_IP_HASH_SALT,
}

describe('quote-requests collection', () => {
  let payload: Payload

  beforeAll(async () => {
    serverEnv.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA'
    serverEnv.QUOTE_IP_HASH_SALT = salt
    const databaseName = `ecolitea2-quote-requests-${randomUUID()}`
    const databaseURI = createIsolatedTestDatabaseURI(databaseName)
    console.info(`Quote request test target: ${databaseURI}`)
    const config = await buildConfig({
      telemetry: false,
      collections: [
        {
          slug: 'products',
          versions: { drafts: true },
          fields: [
            { name: 'title', type: 'text' },
            { name: 'slug', type: 'text' },
            { name: 'publishedAt', type: 'date' },
          ],
        },
        QuoteRequests,
      ],
      db: mongooseAdapter({
        connectOptions: { serverSelectionTimeoutMS: 3_000 },
        url: databaseURI,
      }),
      secret: 'quote-request-test-secret-that-is-at-least-32-characters',
    })
    payload = await getPayload({ config, key: databaseName })
    await payload.create({
      collection: 'products',
      // The isolated product schema deliberately omits unrelated application fields.
      data: {
        title: 'Paper Bag',
        slug: 'bag',
        publishedAt: '2020-01-01T00:00:00.000Z',
        _status: 'published',
      } as RequiredDataFromCollectionSlug<'products'>,
      overrideAccess: true,
    })
    await payload.create({
      collection: 'products',
      data: {
        title: 'Secret Draft',
        slug: 'draft',
        _status: 'draft',
      } as RequiredDataFromCollectionSlug<'products'>,
      overrideAccess: true,
    })
  }, 15_000)

  afterAll(async () => {
    serverEnv.TURNSTILE_SECRET_KEY = originalProtection.secret
    serverEnv.QUOTE_IP_HASH_SALT = originalProtection.salt
    if (payload) {
      const connection = (payload.db as MongooseAdapter).connection
      console.info(
        `Quote request test cleanup: ${connection.host}:${connection.port}/${connection.name}`,
      )
      await connection.dropDatabase()
      await payload.destroy()
    }
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    if (!payload) return
    await payload.delete({
      collection: 'quote-requests',
      where: { id: { exists: true } },
      overrideAccess: true,
    })
  })

  const stubTurnstile = (success: boolean) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ success })),
    )

  const body = (overrides: Record<string, unknown> = {}) => ({
    name: 'Ada',
    email: 'ada@example.com',
    company: 'Lovelace Ltd',
    message: 'Need 500 units',
    productSlug: 'bag',
    turnstileToken: 'tok',
    ...overrides,
  })

  const submit = async (payloadBody: unknown, ip = '203.0.113.7') => {
    const req = {
      payload,
      headers: new Headers({ 'x-forwarded-for': ip, 'user-agent': 'vitest' }),
      json: async () => payloadBody,
    } as unknown as PayloadRequest
    const response = await submitQuoteRequestEndpoint.handler(req)
    return { status: response.status, json: await response.json() }
  }

  const count = async () =>
    (await payload.count({ collection: 'quote-requests', overrideAccess: true })).totalDocs

  it('stores a request with server-resolved product data and a hashed IP', async () => {
    stubTurnstile(true)
    const { status, json } = await submit(body({ productTitle: 'Forged title' }))
    expect(status).toBe(200)
    expect(json).toEqual({ ok: true })
    const { docs } = await payload.find({ collection: 'quote-requests', overrideAccess: true })
    expect(docs).toHaveLength(1)
    expect(docs[0]).toMatchObject({
      name: 'Ada',
      email: 'ada@example.com',
      company: 'Lovelace Ltd',
      status: 'new',
      productTitle: 'Paper Bag',
      productSlug: 'bag',
      ipHash: hashClientIp('203.0.113.7', salt),
      userAgent: 'vitest',
    })
    expect(docs[0].product).toBeTruthy()
  })

  it('rejects invalid fields with field errors and stores nothing', async () => {
    stubTurnstile(true)
    const { status, json } = await submit(body({ email: 'nope', name: '' }))
    expect(status).toBe(400)
    expect(json.code).toBe('validation')
    expect(Object.keys(json.fieldErrors).sort()).toEqual(['email', 'name'])
    expect(await count()).toBe(0)
  })

  it('maps native Payload field validation failures to client field errors', async () => {
    stubTurnstile(true)
    const { status, json } = await submit(body({ email: 'ada..name@example.com' }))
    expect(status).toBe(400)
    expect(json.code).toBe('validation')
    expect(json.fieldErrors.email).toBeTruthy()
    expect(await count()).toBe(0)
  })

  it('rejects unknown and unpublished products', async () => {
    stubTurnstile(true)
    for (const productSlug of ['missing', 'draft']) {
      const { status, json } = await submit(body({ productSlug }))
      expect(status).toBe(400)
      expect(json.code).toBe('validation')
      expect(json.fieldErrors.productSlug).toBeTruthy()
    }
    expect(await count()).toBe(0)
  })

  it('rejects a failed Turnstile verification', async () => {
    stubTurnstile(false)
    const { status, json } = await submit(body())
    expect(status).toBe(403)
    expect(json.code).toBe('verification')
    expect(await count()).toBe(0)
  })

  it('rejects a missing token without calling Cloudflare', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { status, json } = await submit(body({ turnstileToken: undefined }))
    expect(status).toBe(403)
    expect(json.code).toBe('verification')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('returns 429 once an IP exceeds the hourly limit, without affecting other IPs', async () => {
    stubTurnstile(true)
    for (let index = 0; index < QUOTE_RATE_LIMIT.max; index += 1) {
      expect((await submit(body())).status).toBe(200)
    }
    const limited = await submit(body())
    expect(limited.status).toBe(429)
    expect(limited.json.code).toBe('rate_limited')
    expect(await count()).toBe(QUOTE_RATE_LIMIT.max)
    expect((await submit(body(), '198.51.100.9')).status).toBe(200)
  })

  it('ignores requests outside the rate-limit window', async () => {
    stubTurnstile(true)
    for (let index = 0; index < QUOTE_RATE_LIMIT.max; index += 1) await submit(body())
    const ipHash = hashClientIp('203.0.113.7', salt)
    const later = new Date(Date.now() + QUOTE_RATE_LIMIT.windowMs + 1_000)
    expect(await isQuoteRateLimited(payload, ipHash, new Date())).toBe(true)
    expect(await isQuoteRateLimited(payload, ipHash, later)).toBe(false)
  })

  it('returns a validation error for a non-JSON body', async () => {
    const req = {
      payload,
      headers: new Headers(),
      json: async () => {
        throw new SyntaxError('bad json')
      },
    } as unknown as PayloadRequest
    const response = await submitQuoteRequestEndpoint.handler(req)
    expect(response.status).toBe(400)
    expect((await response.json()).code).toBe('validation')
  })

  it('enforces the email length limit on Local API writes too', async () => {
    await expect(
      payload.create({
        collection: 'quote-requests',
        data: { ...body({ email: `${'a'.repeat(250)}@example.com` }), status: 'new' },
        overrideAccess: true,
      }),
    ).rejects.toThrow()
  })

  it.each(['TURNSTILE_SECRET_KEY', 'QUOTE_IP_HASH_SALT'] as const)(
    'fails closed when %s is unconfigured',
    async (key) => {
      const value = serverEnv[key]
      delete serverEnv[key]
      try {
        stubTurnstile(true)
        const result = await submit(body())
        expect(result.status).toBe(500)
        expect(result.json).toEqual({ ok: false, code: 'server' })
        expect(fetch).not.toHaveBeenCalled()
        expect(await count()).toBe(0)
      } finally {
        serverEnv[key] = value
      }
    },
  )

  it('returns a safe error if storing the request fails', async () => {
    stubTurnstile(true)
    vi.spyOn(payload, 'create').mockRejectedValueOnce(new Error('database unavailable'))
    const logger = vi.spyOn(payload.logger, 'error').mockImplementation(() => {})
    const result = await submit(body())
    expect(result).toEqual({ status: 500, json: { ok: false, code: 'server' } })
    expect(logger).toHaveBeenCalledOnce()
    expect(await count()).toBe(0)
  })

  it('does not let the public create or read documents through access control', async () => {
    await expect(
      payload.create({
        collection: 'quote-requests',
        overrideAccess: false,
        data: { name: 'x', email: 'x@example.com', company: 'x', message: 'x', status: 'new' },
      }),
    ).rejects.toThrow()
    await expect(
      payload.find({ collection: 'quote-requests', overrideAccess: false }),
    ).rejects.toThrow()
  })
})

describe('quote-requests admin presentation', () => {
  it('is listed as Quote Requests in the Products admin group', () => {
    expect(QuoteRequests.admin?.group).toBe('Products')
    expect(QuoteRequests.labels).toEqual({ singular: 'Quote Request', plural: 'Quote Requests' })
  })
})
