import type { PayloadRequest } from 'payload'

export const activityCollections = ['products', 'blogs', 'pages'] as const
const dayMs = 24 * 60 * 60 * 1000

/** Documents updated per UTC day over the last `days` days, oldest first. Null when any count fails. */
export async function getContentActivity(req: PayloadRequest, now = new Date(), days = 7) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const starts = Array.from({ length: days }, (_, index) => today - (days - 1 - index) * dayMs)

  try {
    const counts = await Promise.all(starts.map(async (start) => {
      const where = {
        and: [
          { updatedAt: { greater_than_equal: new Date(start).toISOString() } },
          { updatedAt: { less_than: new Date(start + dayMs).toISOString() } },
        ],
      }
      const perCollection = await Promise.all(activityCollections.map((collection) =>
        req.payload.count({ collection, where, req, overrideAccess: false, disableErrors: true })))
      return perCollection.reduce((sum, { totalDocs }) => sum + totalDocs, 0)
    }))
    const result = starts.map((start, index) => ({
      date: new Date(start).toISOString().slice(0, 10),
      count: counts[index]!,
    }))
    return { days: result, total: counts.reduce((sum, count) => sum + count, 0) }
  } catch {
    return null
  }
}
