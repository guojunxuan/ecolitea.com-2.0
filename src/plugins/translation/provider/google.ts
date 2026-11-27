import { decodeEntities } from '../lexical'
import {
  QuotaExceededError,
  RetryableTranslationError,
  type TranslationInput,
  type TranslationProvider,
} from './types'

type GoogleResponse = {
  data?: { translations?: { translatedText?: unknown }[] }
  error?: { message?: string; status?: string; errors?: { reason?: string }[] }
}

export class GoogleTranslationProvider implements TranslationProvider {
  constructor(private readonly apiKey: string) {}
  async translate({ texts, target, source, format }: TranslationInput): Promise<string[]> {
    const translated: string[] = []
    for (let start = 0; start < texts.length; start += 128) {
      const batch = texts.slice(start, start + 128)
      let response: Response
      try {
        response = await fetch(
          `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(this.apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: batch, target, source, format }),
            signal: AbortSignal.timeout(30000),
            cache: 'no-store',
          },
        )
      } catch {
        // Never persist the raw fetch error: it can contain the API key in the URL.
        throw new RetryableTranslationError('Translation provider network request failed')
      }
      const body = (await response.json().catch(() => null)) as GoogleResponse | null
      if (response.status === 429 || response.status >= 500) {
        throw new RetryableTranslationError(
          `Translation provider temporarily unavailable (${response.status})`,
        )
      }
      const quotaReason = [
        body?.error?.message,
        body?.error?.status,
        ...(Array.isArray(body?.error?.errors) ? body.error.errors.map((error) => error?.reason) : []),
      ].join(' ')
      if (
        response.status === 403 &&
        /daily.?limit.?exceeded|quota.?exceeded|(?:user)?rate.?limit.?exceeded|RESOURCE_EXHAUSTED/i.test(
          quotaReason,
        )
      ) {
        throw new QuotaExceededError('Translation provider quota exceeded')
      }
      if (!response.ok)
        throw new Error(`Translation provider rejected request (${response.status})`)
      const results = body?.data?.translations
      if (
        !Array.isArray(results) ||
        results.length !== batch.length ||
        results.some((item) => !item || typeof item.translatedText !== 'string')
      ) {
        throw new RetryableTranslationError('Translation provider returned an invalid response')
      }
      translated.push(
        ...results.map(({ translatedText }) =>
          format === 'text' ? decodeEntities(translatedText as string) : (translatedText as string),
        ),
      )
    }
    return translated
  }
}
