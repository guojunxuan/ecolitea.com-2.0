import en from './dictionaries/en.json'
import type { FrontendDictionary } from './types'

type ErrorCopy = FrontendDictionary['quote']['errors']

/** The API keeps its existing validation contract; translate known errors at display time. */
export function localizeQuoteError(
  message: string | undefined,
  copy: ErrorCopy,
): string | undefined {
  if (!message) return message
  const key = (Object.keys(en.quote.errors) as (keyof ErrorCopy)[]).find(
    (key) => en.quote.errors[key] === message,
  )
  return key ? copy[key] : message
}
