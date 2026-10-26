import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CMSLink } from '@/components/Link'
import { Pagination } from '@/components/Pagination'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { CategoryBand } from '@/components/Products/CategoryBand'
import { CategoryCard } from '@/components/Products/CategoryCard'
import { ProductCard } from '@/components/Products/ProductCard'
import { OverflowCarousel } from '@/components/Products/OverflowCarousel'
import { getProductCategoryBySlug } from '@/utilities/products/getProductCategoryBySlug'
import { getProductCategoriesOverview } from '@/utilities/products/getProductCategoriesOverview'
import { getProductListing } from '@/utilities/products/getProductListing'
import { getDefaultInquiryButtons } from '@/utilities/products/getDefaultInquiryButtons'
import { getProductListingSEO } from '@/utilities/products/getProductListingSEO'
import { productCategoryPath } from '@/utilities/products/paths'
import { getMediaUrl } from '@/utilities/getMediaUrl'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import styles from './listing.module.css'

type ListingArgs = { categorySlug: string; page: number }
export function parsePageNumber(value: string): number {
  if (!/^[1-9]\d*$/.test(value)) notFound()
  const page = Number(value)
  if (!Number.isSafeInteger(page) || page < 2) notFound()
  return page
}
export async function renderProductListing({ categorySlug, page }: ListingArgs) {
  const category = await getProductCategoryBySlug(categorySlug)
  const url = productCategoryPath(categorySlug, page)
  if (!category) return <PayloadRedirects url={url} />
  const [listing, actions, categories] = await Promise.all([
    getProductListing(category.id, page),
    getDefaultInquiryButtons(),
    getProductCategoriesOverview(),
  ])
  if (page > Math.max(1, listing.totalPages)) notFound()
  const others = categories.filter((item) => item.id !== category.id)
  const base = productCategoryPath(category.slug)
  return (
    <div>
      <PayloadRedirects disableNotFound url={url} />
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
        actions={
          actions.length
            ? actions.map((action, index) => (
                <CMSLink
                  key={index}
                  {...action}
                  className={action.appearance === 'outline' ? styles.bandOutline : undefined}
                  appearance={action.appearance ?? 'default'}
                />
              ))
            : null
        }
      />
      <div className={styles.products}>
        <div className={styles.container}>
          {listing.docs.length ? (
            <div className={styles.grid}>
              {listing.docs.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <p>No products found.</p>
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
            eyebrow="Keep exploring"
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
}: ListingArgs): Promise<Metadata> {
  const category = await getProductCategoryBySlug(categorySlug)
  if (!category) return { robots: { index: false, follow: false } }
  const seo = await getProductListingSEO()
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
  return {
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
  }
}
