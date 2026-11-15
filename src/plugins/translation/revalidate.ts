import { serverEnv } from '@/utilities/env'
import { revalidatePath, revalidateTag } from 'next/cache'
import { RetryableTranslationError } from './provider/types'

export type TranslationInvalidation = { tags?: string[]; paths?: string[] }
export const REVALIDATION_LIMIT = 100

export async function requestRevalidation(invalidation: TranslationInvalidation): Promise<void> {
  if (!serverEnv.REVALIDATE_SECRET)
    throw new RetryableTranslationError('Revalidation secret is not configured')
  try {
    const entries: { kind: 'tags' | 'paths'; value: string }[] = [
      ...[...new Set(invalidation.tags ?? [])].map((value) => ({ kind: 'tags' as const, value })),
      ...[...new Set(invalidation.paths ?? [])].map((value) => ({ kind: 'paths' as const, value })),
    ]
    for (let index = 0; index < entries.length; index += REVALIDATION_LIMIT) {
      const batch: Required<TranslationInvalidation> = { tags: [], paths: [] }
      for (const entry of entries.slice(index, index + REVALIDATION_LIMIT))
        batch[entry.kind].push(entry.value)
      const response = await fetch(`${serverEnv.NEXT_PUBLIC_SERVER_URL}/next/revalidate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${serverEnv.REVALIDATE_SECRET}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(batch),
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      })
      if (!response.ok) throw new Error('Revalidation request failed')
    }
  } catch {
    throw new RetryableTranslationError('Revalidation endpoint is unavailable')
  }
}

/** Gather the full set before calling Next: its first missing-store error must
 * not prevent later paths/tags from being sent to the background endpoint.
 * Installed Next 16 throws this invariant outside its request work store. Other
 * errors remain errors; direct request profiles and English paths are retained.
 */
export function createRevalidation() {
  const operations: (() => void)[] = []
  const tags = new Set<string>()
  const paths = new Set<string>()
  return {
    revalidateTag(...args: Parameters<typeof revalidateTag>): void {
      tags.add(args[0])
      operations.push(() => revalidateTag(...args))
    },
    revalidatePath(...args: Parameters<typeof revalidatePath>): void {
      paths.add(args[0])
      operations.push(() => revalidatePath(...args))
    },
    flush(): void | Promise<void> {
      try {
        for (const operation of operations) operation()
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('static generation store missing'))
          throw error
        return requestRevalidation({ tags: [...tags], paths: [...paths] })
      }
    },
  }
}
