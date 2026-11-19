import type { PayloadRequest } from 'payload'

export async function getRecentQuotes(req: PayloadRequest) {
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
    }))
  } catch {
    return null
  }
}
