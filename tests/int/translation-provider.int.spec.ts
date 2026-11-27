// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import { GoogleTranslationProvider } from '@/plugins/translation/provider/google'
import { createTranslationProvider } from '@/plugins/translation/provider/stub'
import { QuotaExceededError, RetryableTranslationError } from '@/plugins/translation/provider/types'
import { createQuota } from '@/plugins/translation/quota'

afterEach(() => vi.unstubAllGlobals())
const input = { texts: ['Tea'], source: 'en', target: 'de', format: 'text' as const }

describe('translation provider (stubbed HTTP only)', () => {
  it('batches at 128 and preserves response order with text entity decoding', async () => {
    const http = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string) as { q: string[] }
      return Response.json({
        data: { translations: body.q.map((text) => ({ translatedText: `${text} &amp; Tee` })) },
      })
    })
    vi.stubGlobal('fetch', http)
    const texts = Array.from({ length: 257 }, (_, index) => String(index))
    const result = await new GoogleTranslationProvider('test-only-key').translate({
      ...input,
      texts,
    })
    expect(http).toHaveBeenCalledTimes(3)
    expect(http.mock.calls.map(([, init]) => JSON.parse(init.body as string).q.length)).toEqual([
      128, 128, 1,
    ])
    expect(result).toEqual(texts.map((text) => `${text} & Tee`))
    expect(http.mock.calls[0][0]).toBe(
      'https://translation.googleapis.com/language/translate/v2?key=test-only-key',
    )
    expect(JSON.parse(http.mock.calls[0][1].body as string)).toMatchObject({
      source: 'en',
      target: 'de',
      format: 'text',
    })
  })
  it('preserves HTML entities and indexed tags until the Lexical decoder', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        Response.json({
          data: { translations: [{ translatedText: '<x0>Tee &amp; Kaffee</x0>' }] },
        }),
      ),
    )
    expect(
      await new GoogleTranslationProvider('stub-key').translate({ ...input, format: 'html' }),
    ).toEqual(['<x0>Tee &amp; Kaffee</x0>'])
  })
  it.each([429, 500, 503])('classifies HTTP %s as retryable', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status })),
    )
    await expect(new GoogleTranslationProvider('stub-key').translate(input)).rejects.toBeInstanceOf(
      RetryableTranslationError,
    )
  })
  it('classifies quota 403 separately from invalid credentials', async () => {
    const http = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ error: { errors: [{ reason: 'dailyLimitExceeded' }] } }, { status: 403 }),
      )
      .mockResolvedValueOnce(
        Response.json({ error: { message: 'API key invalid' } }, { status: 403 }),
      )
    vi.stubGlobal('fetch', http)
    await expect(new GoogleTranslationProvider('stub-key').translate(input)).rejects.toBeInstanceOf(
      QuotaExceededError,
    )
    await expect(
      new GoogleTranslationProvider('stub-key').translate(input),
    ).rejects.not.toBeInstanceOf(QuotaExceededError)
  })
  it('rejects partial/malformed responses and redacts failed network credentials', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ data: { translations: [] } }))
        .mockResolvedValueOnce(Response.json({ data: { translations: [null] } }))
        .mockRejectedValueOnce(new Error('URL includes private-key')),
    )
    const provider = new GoogleTranslationProvider('private-key')
    await expect(provider.translate(input)).rejects.toBeInstanceOf(RetryableTranslationError)
    await expect(provider.translate(input)).rejects.toBeInstanceOf(RetryableTranslationError)
    await expect(provider.translate(input)).rejects.toThrow('network request failed')
  })
  it('uses the offline stub without credentials and avoids HTTP for empty requests', async () => {
    const http = vi.fn(() => {
      throw new Error('No network allowed')
    })
    vi.stubGlobal('fetch', http)
    expect(await createTranslationProvider().translate(input)).toEqual(input.texts)
    expect(
      await new GoogleTranslationProvider('stub-key').translate({ ...input, texts: [] }),
    ).toEqual([])
    expect(http).not.toHaveBeenCalled()
  })
})

describe('monthly quota through Payload Global access', () => {
  const fixture = () => {
    let state = { month: '2026-11', characters: 0 }
    const payload = {
      findGlobal: vi.fn(async () => ({ ...state })),
      updateGlobal: vi.fn(async ({ data }: { data: typeof state }) => {
        state = { ...data }
        return state
      }),
    } as unknown as Payload
    let current = new Date('2026-11-30T23:59:59Z')
    return {
      payload,
      state: () => state,
      advance: () => {
        current = new Date('2026-12-01T00:00:00Z')
      },
      now: () => current,
    }
  }
  it('reserves, refuses over-limit work, and resets at UTC month boundary', async () => {
    const f = fixture()
    const quota = createQuota(f.payload, 10, f.now)
    expect(await quota.reserve(7)).toBe(true)
    expect(await quota.reserve(4)).toBe(false)
    expect(f.state()).toEqual({ month: '2026-11', characters: 7 })
    f.advance()
    expect(await quota.reserve(10)).toBe(true)
    expect(f.state()).toEqual({ month: '2026-12', characters: 10 })
  })
  it('serializes reservations across instances in the single worker process', async () => {
    const f = fixture()
    const first = createQuota(f.payload, 10, f.now)
    const second = createQuota(f.payload, 10, f.now)
    const accepted = await Promise.all(
      Array.from({ length: 20 }, (_, i) => (i % 2 ? first : second).reserve(1)),
    )
    expect(accepted.filter(Boolean)).toHaveLength(10)
    expect(f.state().characters).toBe(10)
    await expect(first.reserve(-1)).rejects.toThrow('characters')
  })
})
