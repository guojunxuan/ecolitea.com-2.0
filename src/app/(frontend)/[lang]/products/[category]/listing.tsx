import { localizeMetadata } from '@/utilities/i18n/seo'
import { fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import { fallbackListingToEnglish } from '@/utilities/i18n/listingAccess'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from '@/components/LocaleLink'
import { Pagination } from '@/components/Pagination'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { CategoryBand } from '@/components/Products/CategoryBand'
import { CategoryCard } from '@/components/Products/CategoryCard'
import { ProductCard } from '@/components/Products/ProductCard'
import { OverflowCarousel } from '@/components/Products/OverflowCarousel'
import { getProductCategoryBySlug } from '@/utilities/products/getProductCategoryBySlug'
import { getProductCategoriesOverview } from '@/utilities/products/getProductCategoriesOverview'
import { getProductListing } from '@/utilities/products/getProductListing'
import { getProductListingSEO } from '@/utilities/products/getProductListingSEO'
import { productCategoryPath } from '@/utilities/products/paths'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import styles from './listing.module.css'

type ListingArgs = { categorySlug: string; page: number; locale?: string }
export function parsePageNumber(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) notFound()
  const page = Number(value)
  if (!Number.isSafeInteger(page) || page < 2) notFound()
  return page
}
export async function renderProductListing({ categorySlug, page, locale = 'en' }: ListingArgs) {
  const url = productCategoryPath(categorySlug, page)
  await fallbackListingToEnglish(['products'], locale, url)
  const category = await getProductCategoryBySlug(categorySlug, locale)
  await fallbackToEnglish(category, locale, url, () => getProductCategoryBySlug(categorySlug))
  if (!category) return <PayloadRedirects locale={locale} url={url} />
  const [listing, categories] = await Promise.all([
    getProductListing(category.id, page, locale),
    getProductCategoriesOverview(locale),
  ])
  if (page > Math.max(1, listing.totalPages)) {
    await fallbackToEnglish(null, locale, url, async () => {
      const english = await getProductListing(category.id, page)
      return page <= Math.max(1, english.totalPages) ? english : null
    })
    notFound()
  }
  const others = categories.filter((item) => item.id !== category.id)
  const base = productCategoryPath(category.slug)
  return (
    <div>
      <PayloadRedirects locale={locale} disableNotFound url={url} />
      <CategoryBand
        category={category}
        headingLevel="h1"
        breadcrumb={
          <nav aria-label="Breadcrumb">
            <Link href="/products">Products</Link>
            <span aria-hidden="true"> / </span>
            <span>{category.title}</span>
          </nav>
        }
      />
      <div className={styles.products}>
        <div className={styles.container}>
          {listing.docs.length ? (
            <div className={styles.grid}>
              {listing.docs.map((product) => (
                <ProductCard key={product.id} product={product} showAction />
              ))}
            </div>
          ) : (
            <p className="website-type-body-md">No products found.</p>
          )}
          {listing.totalPages > 1 && (
            <Pagination
              className={styles.pagination}
              linkMode
              page={listing.page}
              totalPages={listing.totalPages}
              routeBase={base}
              firstPageHref={base}
            />
          )}
        </div>
      </div>
      {others.length > 0 && (
        <div className={styles.explore}>
          <OverflowCarousel
            variant="categories"
            title="Explore other ranges"
            href="/products"
            linkLabel="All products"
          >
            {others.map((item) => (
              <CategoryCard key={item.id} category={item} />
            ))}
          </OverflowCarousel>
        </div>
      )}
    </div>
  )
}
export async function productListingMetadata({
  categorySlug,
  page,
  locale = 'en',
}: ListingArgs): Promise<Metadata> {
  const category = await getProductCategoryBySlug(categorySlug, locale)
  if (!category) return { robots: { index: false, follow: false } }
  const seo = await getProductListingSEO(locale)
  const baseTitle = category.meta.title || `${category.title} Products`
  const title = page === 1 ? baseTitle : `${baseTitle} — Page ${page}`
  const baseDescription =
    category.meta.description ||
    category.description ||
    `Explore ${category.title.toLowerCase()} products.`
  const description = page === 1 ? baseDescription : `${baseDescription} Page ${page}.`
  const canonical = productCategoryPath(category.slug, page)
  const image = category.meta.image
  const imageURL = image?.url ? getMediaUrl(image.url, undefined, getServerSideURL()) : seo.imageURL
  return localizeMetadata(
    {
      title,
      description,
      twitter: null,
      alternates: { canonical },
      openGraph: mergeOpenGraph({
        title,
        description,
        url: canonical,
        images: imageURL ? [{ url: imageURL }] : undefined,
      }),
    },
    { path: canonical, locale, sourceCollection: 'product-categories', sourceId: category.id },
  )
}
