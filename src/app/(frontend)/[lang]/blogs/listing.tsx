import { localizeMetadata, readySourceIDs } from '@/utilities/i18n/seo'
import {
  getLocalizedDoc,
  getLocalizedList,
  readyTranslationFilter,
} from '@/utilities/i18n/getLocalized'
import { fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import { fallbackListingToEnglish } from '@/utilities/i18n/listingAccess'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import Link from '@/components/LocaleLink'
import React from 'react'
import { getPayload } from 'payload'
import configPromise from '@payload-config'

import { BlogCategoryTabs, type BlogCategoryTab } from '@/components/BlogCategoryTabs'
import { CollectionArchive } from '@/components/CollectionArchive'
import { BlogListingHero } from '@/heros/BlogListingHero'
import { Pagination } from '@/components/Pagination'
import { getBlogListing } from '@/utilities/blogs/getBlogListing'
import { getBlogListingHero } from '@/utilities/blogs/getBlogListingHero'
import { getBlogListingSEO } from '@/utilities/blogs/getBlogListingSEO'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { getSiteIdentity } from '@/utilities/siteIdentity'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'
import type { BlogCategory } from '@/payload-types'

import styles from './listing.module.css'

type ListingArgs = { page: number; categorySlug?: string; locale?: string }
type Category = Pick<BlogCategory, 'id' | 'title' | 'slug' | 'description' | 'meta'>

const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const payload = await getPayload({ config: configPromise })
    const categories: Category[] = []
    let page = 1
    let hasNextPage = true
    while (hasNextPage) {
      const result = await payload.find({
        collection: 'blog-categories',
        depth: 1,
        limit: 100,
        page,
        overrideAccess: false,
        sort: '_order',
        select: { title: true, slug: true, description: true, meta: true },
      })
      categories.push(...result.docs)
      hasNextPage = result.hasNextPage
      page += 1
    }
    return categories
  },
  ['blog-categories-public'],
  { tags: ['blog-categories', 'blogs-list'], revalidate: 600 },
)

const getCategoryCounts = (locale = 'en') =>
  unstable_cache(
    async (): Promise<[string, number][]> => {
      const payload = await getPayload({ config: configPromise })
      const counts = new Map<string, number>()
      let page = 1
      let hasNextPage = true
      while (hasNextPage) {
        const result = await payload.find({
          collection: 'blogs',
          depth: 0,
          draft: false,
          limit: 100,
          page,
          overrideAccess: false,
          select: { category: true },
          where: {
            and: [
              publicBlogVisibility(new Date()),
              ...(await readyTranslationFilter(payload, 'blogs', locale)),
            ],
          },
        })
        for (const blog of result.docs) {
          const id =
            typeof blog.category === 'object' && blog.category !== null
              ? blog.category.id
              : blog.category
          if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
        }
        hasNextPage = result.hasNextPage
        page += 1
      }
      return [...counts]
    },
    ['blog-category-counts', locale],
    { tags: ['blogs-list', 'blog-categories', `translations:${locale}`], revalidate: 600 },
  )()

async function resolveCategory(
  slug?: string,
  locale = 'en',
  englishPath = `/blogs/category/${slug}`,
): Promise<Category | undefined> {
  if (!slug) return undefined
  const category = (await getCategories()).find((item) => item.slug === slug)
  if (!category) notFound()
  const counts = new Map(await getCategoryCounts(locale))
  if (!counts.get(category.id)) {
    await fallbackToEnglish(null, locale, englishPath, async () =>
      new Map(await getCategoryCounts()).get(category.id),
    )
    notFound()
  }
  const translated = await getLocalizedDoc(category, 'blog-categories', locale)
  await fallbackToEnglish(translated, locale, englishPath, async () => category)
  return translated ?? undefined
}

export function parsePageNumber(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) notFound()
  const page = Number(value)
  if (!Number.isSafeInteger(page) || page < 2) notFound()
  return page
}

export async function renderBlogListing({ page, categorySlug, locale = 'en' }: ListingArgs) {
  const path = categorySlug ? `/blogs/category/${categorySlug}` : '/blogs'
  const englishPath = page > 1 ? `${path}/page/${page}` : path
  await fallbackListingToEnglish(['blogs'], locale, englishPath)
  const category = await resolveCategory(categorySlug, locale, englishPath)
  const [categories, countEntries, listing, listingHero] = await Promise.all([
    getCategories(),
    getCategoryCounts(locale),
    getBlogListing(page, category?.id, locale),
    getBlogListingHero(locale),
  ])
  if (page > 1 && (page > listing.totalPages || listing.docs.length === 0)) {
    await fallbackToEnglish(
      null,
      locale,
      `${category ? `/blogs/category/${category.slug}` : '/blogs'}/page/${page}`,
      async () => {
        const english = await getBlogListing(page, category?.id)
        return english.docs.length ? english : null
      },
    )
    notFound()
  }
  const counts = new Map(countEntries)

  const localizedCategories = await getLocalizedList(categories, 'blog-categories', locale)
  const tabs: BlogCategoryTab[] = localizedCategories.map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    count: counts.get(item.id) ?? 0,
  }))
  const routeBase = category ? `/blogs/category/${category.slug}` : '/blogs'
  const heading = category ? `${category.title} Blogs` : 'Blogs'
  // Category routes keep the shared Hero image and theme but present their own copy.
  const hero =
    listingHero && category
      ? { ...listingHero, heading, description: category.description?.trim() || null }
      : listingHero
  const breadcrumb = category && (
    <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
      <Link href="/blogs">Blogs</Link>
      <span aria-hidden="true"> / </span>
      <span>{category.title}</span>
    </nav>
  )

  return (
    <div className={[styles.page, hero && styles.hasHero].filter(Boolean).join(' ')}>
      {hero ? (
        <BlogListingHero {...hero} breadcrumb={breadcrumb} />
      ) : (
        <header className={styles.header}>
          {breadcrumb}
          <h1 className={styles.title}>{heading}</h1>
          {category?.description && <p className={styles.description}>{category.description}</p>}
        </header>
      )}
      <div className={styles.tabs}>
        <BlogCategoryTabs categories={tabs} currentCategory={category?.slug} />
      </div>
      <CollectionArchive posts={listing.docs} relationTo="blogs" />
      {listing.docs.length === 0 && <p className={styles.empty}>No blogs found.</p>}
      {listing.totalPages > 1 && (
        <Pagination
          className={styles.pagination}
          linkMode
          page={listing.page ?? page}
          totalPages={listing.totalPages}
          routeBase={routeBase}
          firstPageHref={routeBase}
        />
      )}
    </div>
  )
}

export async function blogListingMetadata({
  page,
  categorySlug,
  locale = 'en',
}: ListingArgs): Promise<Metadata> {
  const path = categorySlug ? `/blogs/category/${categorySlug}` : '/blogs'
  const englishPath = page > 1 ? `${path}/page/${page}` : path
  await fallbackListingToEnglish(['blogs'], locale, englishPath)
  const category = await resolveCategory(categorySlug, locale, englishPath)
  const seo = await getBlogListingSEO(locale)
  const baseTitle = category
    ? category.meta?.title || `${category.title} Blogs`
    : seo?.title || 'Blogs'
  const title = page === 1 ? baseTitle : `${baseTitle} — Page ${page}`
  const baseDescription =
    (categorySlug ? category?.meta?.description || category?.description : seo?.description) ||
    (category
      ? `Explore ${category.title.toLowerCase()} articles and guides.`
      : 'Explore our latest blog articles, insights, and guides.')
  const description = page === 1 ? baseDescription : `${baseDescription} Page ${page}.`
  const basePath = category ? `/blogs/category/${category.slug}` : '/blogs'
  const canonical = page === 1 ? basePath : `${basePath}/page/${page}`
  const categoryImage = category?.meta?.image
  const imageURL =
    categoryImage && typeof categoryImage === 'object' && categoryImage.url
      ? getMediaUrl(categoryImage.url, undefined, getServerSideURL())
      : seo?.imageURL

  const identity = await getSiteIdentity({ locale: locale })
  const openGraph = mergeOpenGraph(identity, {
    title,
    description,
    url: canonical,
    images: imageURL ? [{ url: imageURL }] : undefined,
  })
  if (categorySlug)
    return localizeMetadata(
      { title, description, alternates: { canonical }, openGraph },
      { path: canonical, locale, sourceCollection: 'blog-categories', sourceId: category?.id },
    )
  return localizeMetadata(
    {
      title,
      description,
      alternates: { canonical },
      openGraph,
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: seo?.imageURL ? [seo.imageURL] : openGraph?.images,
      },
    },
    { path: canonical, locale },
  )
}

export async function getCategoryStaticParams(options: { params: { lang: string } }) {
  const locale = options?.params.lang ?? 'en'
  const [categories, countEntries] = await Promise.all([getCategories(), getCategoryCounts(locale)])
  const counts = new Map(countEntries)
  const ready =
    locale === 'en'
      ? new Set(categories.map(({ id }) => id))
      : await readySourceIDs(
          await getPayload({ config: configPromise }),
          'blog-categories',
          categories.map(({ id }) => id),
          locale,
        )
  return categories
    .filter(({ id }) => (counts.get(id) ?? 0) > 0 && ready.has(id))
    .map(({ slug }) => ({ categorySlug: slug }))
}
