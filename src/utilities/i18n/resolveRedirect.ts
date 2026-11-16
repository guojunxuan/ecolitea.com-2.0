import type { CollectionSlug, Payload } from 'payload'
import type { Redirect } from '@/payload-types'
import { getI18nSettings } from '@/i18n/getI18nSettings'
import { localePath, stripLocale, isLocaleNeutralPath } from '@/i18n/paths'
import { getContentPath } from '@/utilities/getContentPath'
import { publicProductVisibility } from '@/utilities/products/publicVisibility'
import { getLocalizedDoc } from './getLocalized'
import { isPublicSource, publicSourceVisibility } from './publicSourceVisibility'

type Destination = { path: string; permanent: boolean }
type Document = Record<string, unknown> & { id: string; slug?: string; categorySlug?: string }
const permanentCollections = ['blogs', 'products', 'product-categories']

async function isLegalPage(payload: Payload, collection: string, id: string): Promise<boolean> {
  if (
    collection !== 'pages' ||
    !payload.config.globals.some(({ slug }) => slug === 'site-settings')
  )
    return false
  const settings = await payload.findGlobal({
    slug: 'site-settings',
    overrideAccess: false,
    depth: 0,
  })
  return [settings.privacyPolicyPage, settings.cookiePolicyPage, settings.termsPage].some(
    (value) => String(value && typeof value === 'object' ? value.id : value) === id,
  )
}

async function documentDestination(
  payload: Payload,
  collection: CollectionSlug,
  doc: Document,
  locale: string,
  permanent: boolean,
): Promise<Destination | null> {
  if (!doc.slug || !isPublicSource(doc, collection)) return null
  const english =
    collection === 'pages' && doc.slug === 'home'
      ? '/'
      : getContentPath(collection, doc.slug, { categorySlug: doc.categorySlug })
  if (!english) return null
  if (collection === 'product-categories') {
    const visible = await payload.find({
      collection: 'products',
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1,
      where: { and: [{ category: { equals: doc.id } }, publicProductVisibility(new Date())] },
    })
    if (!visible.docs.length) return null
  }
  if (locale === 'en') return { path: english, permanent }
  if (await isLegalPage(payload, collection, doc.id)) return { path: english, permanent: true }
  const localized = await getLocalizedDoc(doc, collection, locale, payload)
  return localized
    ? { path: localePath(english, locale), permanent }
    : { path: english, permanent: false }
}

/** Resolve current source identities using anonymous access; cached populated
 * slugs and index paths never decide publication or translation readiness. */
export async function resolveLocalizedRedirect(
  payload: Payload,
  item: Pick<Redirect, 'to'>,
  locale = 'en',
): Promise<Destination | null> {
  const { publicLocales } = await getI18nSettings(payload)
  if (!publicLocales.some(({ code }) => code === locale)) return null
  const reference = item.to?.reference
  if (reference && !item.to?.url) {
    const id = typeof reference.value === 'object' ? reference.value.id : reference.value
    if (!id) return null
    const doc = await payload.findByID({
      collection: reference.relationTo,
      id,
      overrideAccess: false,
      draft: false,
      disableErrors: true,
      depth: 0,
    })
    return doc
      ? documentDestination(
          payload,
          reference.relationTo,
          doc as unknown as Document,
          locale,
          permanentCollections.includes(reference.relationTo),
        )
      : null
  }
  const value = item.to?.url
  if (!value) return null
  // Operator-owned external, infrastructure and static resource URLs stay verbatim.
  if (isLocaleNeutralPath(value)) return { path: value, permanent: false }
  const url = new URL(value, 'https://redirect.example.invalid')
  const path = stripLocale(url.pathname)
  const suffix = `${url.search}${url.hash}`
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  let collection: CollectionSlug | undefined
  let slug: string | undefined
  let paginationPath = ''
  if (!parts.length) {
    collection = 'pages'
    slug = 'home'
  } else if (parts.length === 1 && !['blogs', 'posts', 'products', 'search'].includes(parts[0])) {
    collection = 'pages'
    slug = parts[0]
  } else if (
    parts[0] === 'blogs' &&
    parts[1] === 'category' &&
    (parts.length === 3 || (parts.length === 5 && parts[3] === 'page'))
  ) {
    collection = 'blog-categories'
    slug = parts[2]
    if (parts.length === 5) paginationPath = `/page/${encodeURIComponent(parts[4])}`
  } else if (parts.length === 2 && ['blogs', 'posts', 'case-studies'].includes(parts[0])) {
    collection = parts[0] as CollectionSlug
    slug = parts[1]
  } else if (parts[0] === 'products' && parts.length === 3) {
    collection = 'products'
    slug = parts[2]
  } else if (parts[0] === 'products' && parts.length === 4 && parts[2] === 'page') {
    collection = 'product-categories'
    slug = parts[1]
    paginationPath = `/page/${encodeURIComponent(parts[3])}`
  } else if (parts[0] === 'products' && parts.length === 2) {
    collection = 'product-categories'
    slug = parts[1]
  }
  if (collection && slug) {
    const result = await payload.find({
      collection,
      overrideAccess: false,
      draft: false,
      depth: 0,
      limit: 1,
      pagination: false,
      where: {
        and: [
          { slug: { equals: slug } },
          publicSourceVisibility(collection),
          ...(collection === 'products' ? [{ categorySlug: { equals: parts[1] } }] : []),
        ],
      },
    })
    const doc = result.docs[0]
    if (!doc) return null
    const destination = await documentDestination(
      payload,
      collection,
      doc as unknown as Document,
      locale,
      false,
    )
    if (!destination) return null
    // Explicit URL destinations remain temporary, except English-only legal pages.
    return {
      ...destination,
      path: `${destination.path}${paginationPath}${suffix}`,
    }
  }
  return { path: `${localePath(path, locale)}${suffix}`, permanent: false }
}
