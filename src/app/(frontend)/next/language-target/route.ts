import { getBlogListing } from '@/utilities/blogs/getBlogListing'
import { getProductListing } from '@/utilities/products/getProductListing'
import { readyTranslationFilter } from '@/utilities/i18n/getLocalized'
import { publicLocales } from '@/i18n/config'
import { localePath, stripLocale } from '@/i18n/paths'
import { getDocumentBySlug } from '@/utilities/i18n/getDocumentBySlug'
import { legalPagePaths } from '@/utilities/i18n/pageAccess'
import { getBlogBySlug } from '@/utilities/blogs/getBlogBySlug'
import { getProductBySlug } from '@/utilities/products/getProductBySlug'
import { getProductCategoryBySlug } from '@/utilities/products/getProductCategoryBySlug'
import { getLocalizedDoc } from '@/utilities/i18n/getLocalized'
import { getPayload } from 'payload'
import config from '@payload-config'

/** Public, read-only switch destination. URL language always wins over cookies. */
export async function GET(request: Request): Promise<Response> {
  const query = new URL(request.url).searchParams
  const locale = query.get('locale') ?? ''
  const path = query.get('path') ?? '/'
  if (
    !publicLocales.some(({ code }) => code === locale) ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    /^\/(api|admin|next|_next)(\/|$)/.test(path)
  )
    return new Response(null, { status: 400 })
  const english = stripLocale(new URL(path, 'https://site.example.invalid').pathname)
  let parts: string[]
  try {
    parts = english.split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return new Response(null, { status: 400 })
  }
  if ((await legalPagePaths()).includes(english)) return Response.json({ href: english })
  let ready: unknown = false
  if (
    parts.length === 0 ||
    (parts.length === 1 && !['products', 'blogs', 'posts', 'search'].includes(parts[0]))
  ) {
    ready = await getDocumentBySlug('pages', parts[0] ?? 'home', locale)
  } else if (parts[0] === 'products' && parts.length === 3 && parts[2] !== 'page') {
    const product = await getProductBySlug(parts[2], { locale })
    ready = product?.categorySlug === parts[1]
  } else if (parts[0] === 'products' && parts.length >= 2) {
    ready = await getProductCategoryBySlug(parts[1], locale)
  } else if (parts[0] === 'blogs' && parts[1] === 'category') {
    const payload = await getPayload({ config })
    const result = await payload.find({
      collection: 'blog-categories',
      draft: false,
      overrideAccess: false,
      depth: 0,
      limit: 1,
      where: { slug: { equals: parts[2] } },
    })
    ready = await getLocalizedDoc(result.docs[0], 'blog-categories', locale, payload)
  } else if (parts[0] === 'blogs' && parts.length === 2)
    ready = await getBlogBySlug(parts[1], false, locale)
  else if (parts[0] === 'posts' && parts.length === 2)
    ready = await getDocumentBySlug('posts', parts[1], locale)
  else if (parts[0] === 'case-studies' && parts.length === 2)
    ready = await getDocumentBySlug('case-studies', parts[1], locale)
  else if (['blogs', 'posts', 'products', 'search'].includes(parts[0])) ready = true
  if (ready && parts[0] === 'blogs' && parts[1] === 'category') {
    const categoryId =
      typeof ready === 'object' && ready && 'id' in ready ? String(ready.id) : undefined
    const page = parts[3] === 'page' ? Number(parts[4]) : 1
    const listing = await getBlogListing(page, categoryId, locale)
    ready = Number.isSafeInteger(page) && page > 0 && listing.docs.length > 0
  } else if (ready && parts.at(-2) === 'page') {
    const page = Number(parts.at(-1))
    if (!Number.isSafeInteger(page) || page < 2) ready = false
    else if (parts[0] === 'blogs')
      ready = (await getBlogListing(page, undefined, locale)).docs.length > 0
    else if (parts[0] === 'products' && typeof ready === 'object' && ready && 'id' in ready) {
      ready = (await getProductListing(String(ready.id), page, locale)).docs.length > 0
    } else if (parts[0] === 'posts') {
      const payload = await getPayload({ config })
      ready =
        (
          await payload.find({
            collection: 'posts',
            draft: false,
            overrideAccess: false,
            depth: 0,
            page,
            limit: 12,
            where: { and: await readyTranslationFilter(payload, 'posts', locale) },
          })
        ).docs.length > 0
    }
  }
  const href = ready
    ? localePath(english, locale)
    : `${localePath('/', locale)}?unavailable=${encodeURIComponent(locale)}`
  return Response.json({ href }, { headers: { 'Cache-Control': 'no-store' } })
}
