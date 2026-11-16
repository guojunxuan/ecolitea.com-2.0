import { localizeMetadata } from '@/utilities/i18n/seo'
import { fallbackListingToEnglish } from '@/utilities/i18n/listingAccess'
import type { Metadata } from 'next'
import Link from '@/components/LocaleLink'
import { CMSLink } from '@/components/Link'
import { Media } from '@/components/Media'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { AnchorNav } from '@/components/Products/AnchorNav'
import { CategoryCarousel } from '@/components/Products/CategoryCarousel'
import { ProductCard } from '@/components/Products/ProductCard'
import { ProductPreviewGrid } from '@/components/Products/ProductPreviewGrid'
import { ProductListingHero } from '@/heros/ProductListingHero'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import { getProductCategoriesOverview } from '@/utilities/products/getProductCategoriesOverview'
import { getProductCategoryCarousel } from '@/utilities/products/getProductCategoryCarousel'
import { getProductListingHero } from '@/utilities/products/getProductListingHero'
import { getProductListingSEO } from '@/utilities/products/getProductListingSEO'
import { productCategoryPath } from '@/utilities/products/paths'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import styles from './page.module.css'

export const dynamic = 'force-static'
export const revalidate = 600
const CATEGORY_CAROUSEL_ID = 'product-category-carousel'
export default async function ProductsPage({ params }: { params?: Promise<{ lang: string }> }) {
  const { lang = 'en' } = (await params) ?? {}
  const [categories, hero, seo] = await Promise.all([
    getProductCategoriesOverview(lang),
    getProductListingHero(lang),
    getProductListingSEO(lang),
  ])
  if (!categories.length) await fallbackListingToEnglish(['products'], lang, '/products')
  const categoryItems = await getProductCategoryCarousel(categories, lang)
  return (
    <div className={styles.root}>
      <PayloadRedirects locale={lang} disableNotFound url="/products" />
      {hero.length ? (
        <>
          <h1 className={styles.pageTitle}>{seo.title || 'Products'}</h1>
          <ProductListingHero slides={hero} />
        </>
      ) : (
        <header className={styles.header}>
          <HeaderThemeSync theme="light" />
          <p className="website-type-eyebrow">Products</p>
          <h1 className={styles.heading}>{seo.title || 'Products'}</h1>
          {seo.description && <p className={styles.description}>{seo.description}</p>}
        </header>
      )}
      {categories.length ? (
        <>
          <CategoryCarousel id={CATEGORY_CAROUSEL_ID} items={categoryItems} />
          <AnchorNav
            variant="category"
            revealAfter={categoryItems.length ? CATEGORY_CAROUSEL_ID : undefined}
            items={categories.map((category) => ({ id: category.slug, label: category.title }))}
          />
          {categories.map((category) => {
            const products = category.products.slice(0, 4)
            const href = productCategoryPath(category.slug)
            const headingID = `${category.slug}-heading`
            const { image, imageFit } = category
            return (
              <section
                key={category.id}
                id={category.slug}
                aria-labelledby={headingID}
                className={styles.category}
              >
                <div className="site-container">
                  <div className={`${styles.categoryIntro} ${!image ? styles.textOnly : ''}`}>
                    {image && (
                      <Link
                        href={href}
                        aria-label={`Explore ${category.title}`}
                        className={styles.categoryMedia}
                        data-image-fit={imageFit}
                      >
                        <Media
                          resource={image}
                          fill
                          htmlElement={null}
                          pictureClassName={styles.categoryPicture}
                          imgClassName={styles.categoryImage}
                          presentation={{ image: { fit: imageFit } }}
                          size="(min-width: 1284px) 732px, (min-width: 1024px) 60vw, (min-width: 768px) 56vw, 100vw"
                        />
                      </Link>
                    )}
                    <div className={styles.categoryCopy}>
                      <h2
                        id={headingID}
                        className={`website-type-heading-1 ${styles.categoryTitle}`}
                      >
                        {category.title}
                      </h2>
                      {category.description && (
                        <p className={`website-type-body-md ${styles.categoryDescription}`}>
                          {category.description}
                        </p>
                      )}
                      <div className={styles.categoryActions}>
                        <CMSLink type="custom" url={href} label="View More" appearance="default" />
                      </div>
                    </div>
                  </div>
                  <p className={`website-type-heading-3 ${styles.productsHeading}`}>
                    Latest Products
                  </p>
                </div>
                <ProductPreviewGrid
                  href={href}
                  categoryTitle={category.title}
                  totalProducts={category.productCount}
                >
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} showAction />
                  ))}
                </ProductPreviewGrid>
              </section>
            )
          })}
        </>
      ) : (
        <p className={styles.empty}>No products yet.</p>
      )}
    </div>
  )
}
export async function generateMetadata(args: {
  params: Promise<{ lang: string }>
}): Promise<Metadata> {
  const lang = (await args?.params)?.lang ?? 'en'
  const seo = await getProductListingSEO(lang)
  const title = seo.title || 'Products'
  const description = seo.description || 'Explore our products.'
  const openGraph = mergeOpenGraph({
    title,
    description,
    url: '/products',
    images: seo.imageURL ? [{ url: seo.imageURL }] : undefined,
  })
  return localizeMetadata(
    {
      title,
      description,
      alternates: { canonical: '/products' },
      openGraph,
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: seo.imageURL ? [seo.imageURL] : openGraph?.images,
      },
    },
    { path: '/products', locale: lang },
  )
}
