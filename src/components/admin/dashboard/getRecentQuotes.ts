import type { PayloadRequest } from 'payload'

const relativeTime = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

function age(createdAt: string, now: number) {
  const minutes = Math.round((Date.parse(createdAt) - now) / 60_000)
  if (Math.abs(minutes) < 60) return relativeTime.format(minutes, 'minute')
  if (Math.abs(minutes) < 24 * 60) return relativeTime.format(Math.round(minutes / 60), 'hour')
  return relativeTime.format(Math.round(minutes / (24 * 60)), 'day')
}

export async function getRecentQuotes(req: PayloadRequest, now = Date.now()) {
  try {
    const { docs } = await req.payload.find({
      collection: 'quote-requests',
      req,
      overrideAccess: false,
      depth: 1,
      limit: 5,
      sort: '-createdAt',
      select: { name: true, company: true, productTitle: true, product: true, status: true, createdAt: true },
      populate: { products: { title: true } },
    })
    return docs.map(({ id, name, company, product, productTitle, status, createdAt }) => ({
      id,
      name,
      company,
      product: productTitle || (typeof product === 'object' ? product?.title : null) || null,
      status,
      createdAt,
      relativeTime: age(createdAt, now),
    }))
  } catch {
    return null
  }
}
