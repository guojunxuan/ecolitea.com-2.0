import { serverEnv } from '@/utilities/env'
import { RetryableTranslationError } from './provider/types'

export type TranslationInvalidation = { tags?: string[]; paths?: string[] }

// The Route Handler implementation and its request-context fallback are Task 7.
// This leaf client is required by the Task 6 durable translation workflow.
export async function requestRevalidation(invalidation: TranslationInvalidation): Promise<void> {
  if (!serverEnv.REVALIDATE_SECRET)
    throw new RetryableTranslationError('Revalidation secret is not configured')
  try {
    const response = await fetch(`${serverEnv.NEXT_PUBLIC_SERVER_URL}/next/revalidate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${serverEnv.REVALIDATE_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidation),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error('Revalidation request failed')
  } catch {
    throw new RetryableTranslationError('Revalidation endpoint is unavailable')
  }
}
