import type { PayloadRequest } from 'payload'
import { getI18nSettings } from '@/i18n/getI18nSettings'

export async function getOverview(req: PayloadRequest) {
  const { payload } = req
  const access = { req, overrideAccess: false, disableErrors: true }
  try {
    const [published, drafts, quotes, blogs, i18n] = await Promise.all([
      payload.count({ ...access, collection: 'products', where: { _status: { equals: 'published' } } }),
      payload.count({ ...access, collection: 'products', where: { _status: { equals: 'draft' } } }),
      payload.count({ ...access, collection: 'quote-requests', where: { status: { equals: 'new' } } }),
      payload.count({ ...access, collection: 'blogs' }),
      getI18nSettings(payload, req),
    ])
    return {
      published: published.totalDocs,
      drafts: drafts.totalDocs,
      quotes: quotes.totalDocs,
      blogs: blogs.totalDocs,
      languages: i18n.targetLocales.length + 1,
    }
  } catch {
    return null
  }
}
