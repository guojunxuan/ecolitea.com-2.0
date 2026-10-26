import type { Metadata } from 'next'
import { CMSLink } from '@/components/Link'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { AnchorNav } from '@/components/Products/AnchorNav'
import { CategoryBand } from '@/components/Products/CategoryBand'
import { ProductCard } from '@/components/Products/ProductCard'
import { ProductMoreCard } from '@/components/Products/ProductMoreCard'
import { ProductPreviewGrid } from '@/components/Products/ProductPreviewGrid'
import { BlogListingHero } from '@/heros/BlogListingHero'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import { getProductCategoriesOverview } from '@/utilities/products/getProductCategoriesOverview'
import { getProductListingHero } from '@/utilities/products/getProductListingHero'
import { getDefaultInquiryButtons } from '@/utilities/products/getDefaultInquiryButtons'
import { getProductListingSEO } from '@/utilities/products/getProductListingSEO'
import { productCategoryPath } from '@/utilities/products/paths'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import styles from './page.module.css'

export const dynamic = 'force-static'
export const revalidate = 600
export default async function ProductsPage() {
  const [categories, hero, actions, seo] = await Promise.all([
    getProductCategoriesOverview(),
    getProductListingHero(),
    getDefaultInquiryButtons(),
    getProductListingSEO(),
  ])
  return (
    <div className={styles.root}>
      <PayloadRedirects disableNotFound url="/products" />
      {hero ? (
        <BlogListingHero {...hero} />
      ) : (
        <header className={styles.header}>
          <HeaderThemeSync theme="light" />
          <p className="website-type-eyebrow">Products</p>
          <h1>{seo.title || 'Products'}</h1>
          {seo.description && <p>{seo.description}</p>}
        </header>
      )}
      {categories.length ? (
        <>
          <AnchorNav
            variant="category"
            items={categories.map((category) => ({ id: category.slug, label: category.title }))}
          />
          {categories.map((category) => {
            const more = category.productCount > 6
            const products = category.products.slice(0, more ? 5 : 6)
            const href = productCategoryPath(category.slug)
            return (
              <section key={category.id} id={category.slug} className={styles.category}>
                <CategoryBand
                  category={category}
                  headingLevel="h2"
                  actions={
                    <>
                      <CMSLink
                        type="custom"
                        url={href}
                        label="View all products"
                        appearance="default"
                      />
                      {actions.map((action, index) => (
                        <span
                          key={index}
                          className={index > 0 ? styles.extraAction : styles.inquiryAction}
                        >
                          <CMSLink
                            {...action}
                            className={
                              action.appearance === 'default' ? undefined : styles.bandOutline
                            }
                            appearance={action.appearance ?? 'outline'}
                          />
                        </span>
                      ))}
                    </>
                  }
                />
                <div className={styles.products}>
                  <ProductPreviewGrid count={products.length + (more ? 1 : 0)}>
                    {products.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                    {more && (
                      <ProductMoreCard
                        href={href}
                        remaining={category.productCount - 5}
                        categoryTitle={category.title}
                        covers={category.moreCovers}
                        productCount={category.productCount}
                      />
                    )}
                  </ProductPreviewGrid>
                </div>
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
export async function generateMetadata(): Promise<Metadata> {
  const seo = await getProductListingSEO()
  const title = seo.title || 'Products'
  const description = seo.description || 'Explore our products.'
  const openGraph = mergeOpenGraph({
    title,
    description,
    url: '/products',
    images: seo.imageURL ? [{ url: seo.imageURL }] : undefined,
  })
  return {
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
  }
}
