import type { Payload } from 'payload'

export const QUOTE_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 } as const

/** Counts recent stored requests for this IP hash in MongoDB, so every instance agrees. */
export async function isQuoteRateLimited(
  payload: Payload,
  ipHash: string,
  now: Date = new Date(),
): Promise<boolean> {
  const since = new Date(now.getTime() - QUOTE_RATE_LIMIT.windowMs).toISOString()
  const { totalDocs } = await payload.count({
    collection: 'quote-requests',
    overrideAccess: true,
    where: { ipHash: { equals: ipHash }, createdAt: { greater_than_equal: since } },
  })
  return totalDocs >= QUOTE_RATE_LIMIT.max
}
