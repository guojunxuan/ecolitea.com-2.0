import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import Link from 'next/link'
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
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'
import type { BlogCategory } from '@/payload-types'

import styles from './listing.module.css'

type ListingArgs = { page: number; categorySlug?: string }
type Category = Pick<BlogCategory, 'id' | 'title' | 'slug' | 'description'>

const getCategories = unstable_cache(
  async (): Promise<Category[]> => {
    const payload = await getPayload({ config: configPromise })
    const categories: Category[] = []
    let page = 1
    let hasNextPage = true
    while (hasNextPage) {
      const result = await payload.find({
        collection: 'blog-categories',
        depth: 0,
        limit: 100,
        page,
        overrideAccess: false,
        sort: '_order',
        select: { title: true, slug: true, description: true },
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

const getCategoryCounts = unstable_cache(
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
        where: publicBlogVisibility(new Date()),
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
  ['blog-category-counts'],
  { tags: ['blogs-list', 'blog-categories'], revalidate: 600 },
)

async function resolveCategory(slug?: string): Promise<Category | undefined> {
  if (!slug) return undefined
  const category = (await getCategories()).find((item) => item.slug === slug)
  if (!category) notFound()
  const counts = new Map(await getCategoryCounts())
  if (!counts.get(category.id)) notFound()
  return category
}

export function parsePageNumber(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) notFound()
  const page = Number(value)
  if (!Number.isSafeInteger(page) || page < 2) notFound()
  return page
}

export async function renderBlogListing({ page, categorySlug }: ListingArgs) {
  const category = await resolveCategory(categorySlug)
  const [categories, countEntries, listing, listingHero] = await Promise.all([
    getCategories(),
    getCategoryCounts(),
    getBlogListing(page, category?.id),
    getBlogListingHero(),
  ])
  if (page > 1 && (page > listing.totalPages || listing.docs.length === 0)) notFound()
  const counts = new Map(countEntries)

  const tabs: BlogCategoryTab[] = categories.map((item) => ({
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

export async function blogListingMetadata({ page, categorySlug }: ListingArgs): Promise<Metadata> {
  const category = await resolveCategory(categorySlug)
  const seo = categorySlug ? null : await getBlogListingSEO()
  const baseTitle = category ? `${category.title} Blogs` : seo?.title || 'Blogs'
  const title = page === 1 ? baseTitle : `${baseTitle} — Page ${page}`
  const baseDescription =
    (categorySlug ? category?.description : seo?.description) ||
    (category
      ? `Explore ${category.title.toLowerCase()} articles and guides.`
      : 'Explore our latest blog articles, insights, and guides.')
  const description = page === 1 ? baseDescription : `${baseDescription} Page ${page}.`
  const basePath = category ? `/blogs/category/${category.slug}` : '/blogs'
  const canonical = page === 1 ? basePath : `${basePath}/page/${page}`
  if (categorySlug) return { title, description, alternates: { canonical } }

  const openGraph = mergeOpenGraph({
    title,
    description,
    url: canonical,
    images: seo?.imageURL ? [{ url: seo.imageURL }] : undefined,
  })
  return {
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
  }
}

export async function getCategoryStaticParams() {
  const [categories, countEntries] = await Promise.all([getCategories(), getCategoryCounts()])
  const counts = new Map(countEntries)
  return categories
    .filter(({ id }) => (counts.get(id) ?? 0) > 0)
    .map(({ slug }) => ({ categorySlug: slug }))
}
