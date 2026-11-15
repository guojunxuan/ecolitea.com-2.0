export type TranslationInput = {
  texts: string[]
  target: string
  source: string
  format: 'text' | 'html'
}
export interface TranslationProvider {
  translate(input: TranslationInput): Promise<string[]>
}
export class RetryableTranslationError extends Error {
  override name = 'RetryableTranslationError'
}
export class QuotaExceededError extends Error {
  override name = 'QuotaExceededError'
}
