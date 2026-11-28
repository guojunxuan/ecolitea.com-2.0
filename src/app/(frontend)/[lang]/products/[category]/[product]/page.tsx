import { localizeMetadata } from '@/utilities/i18n/seo'
import { fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import { connection } from 'next/server'
import Link from '@/components/LocaleLink'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import { ProductDetailNav } from '@/components/Products/ProductDetailNav'
import { OverflowCarousel } from '@/components/Products/OverflowCarousel'
import { ProductCard } from '@/components/Products/ProductCard'
import { ProductGallery } from '@/components/Products/ProductGallery'
import { ProductTabs } from '@/components/Products/ProductTabs'
import { ProductActions } from '@/components/Products/ProductActions'
import {
  RenderProductBlocks,
  type ProductBlock,
} from '@/collections/Products/blocks/RenderProductBlocks'
import { Entrance } from '@/collections/Products/blocks/shared/Entrance'
import { getProductBySlug } from '@/utilities/products/getProductBySlug'
import { getRelatedProducts } from '@/utilities/products/getRelatedProducts'
import { getProductStaticParams } from '@/utilities/products/getProductStaticParams'
import { productCategoryPath, productPath } from '@/utilities/products/paths'
import { getServerSideURL } from '@/utilities/getURL'
import { getTurnstileSiteKey } from '@/utilities/env'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import { getSiteIdentity } from '@/utilities/siteIdentity'
import styles from './page.module.css'

type Args = { params: Promise<{ lang: string; category: string; product: string }> }
/** Full-bleed blocks sit flush against the section edge instead of inside its padding. */
const isFullBleed = (block?: ProductBlock) =>
  block?.blockType === 'productMediaBanner' ||
  (block?.blockType === 'productCode' && block.width === 'full')
export async function generateStaticParams(options: { params: { lang: string } }) {
  const locale = options?.params.lang ?? 'en'
  return (await getProductStaticParams(locale)).products
}
export default async function ProductPage({ params }: Args) {
  const { category, product: slug, lang = 'en' } = await params
  // Keep deployment configuration out of prerendered pages while retaining product data caches.
  await connection()
  const { isEnabled: draft } = await draftMode()
  const siteKey = getTurnstileSiteKey()
  const product = await getProductBySlug(slug, { draft, locale: lang })
  const url = productPath(category, slug)
  await fallbackToEnglish(product, lang, url, () => getProductBySlug(slug))
  if (!product) return <PayloadRedirects locale={lang} url={url} />
  if (product.categorySlug !== category) notFound()
  const related = await getRelatedProducts(product, lang)

  return (
    <article className={styles.root}>
      <HeaderThemeSync theme="light" />
      <PayloadRedirects locale={lang} disableNotFound url={url} />
      {draft && <LivePreviewListener />}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/products">Products</Link>
        <span aria-hidden="true">/</span>
        <Link href={productCategoryPath(category)}>{product.category?.title || category}</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.title}</span>
      </nav>
      <header id="overview" className={styles.overview}>
        <ProductGallery key={product.id} images={product.gallery} />
        <div className={styles.info}>
          <p className={styles.eyebrow}>{product.category?.title}</p>
          <h1 className={styles.title}>{product.title}</h1>
          <ProductTabs
            key={product.id}
            specifications={product.specifications}
            overview={product.overview}
          />
          <ProductActions
            downloads={product.downloads}
            siteKey={siteKey}
            product={{
              title: product.title,
              slug: product.slug,
              categoryTitle: product.category?.title,
              thumbnail: product.gallery[0],
            }}
          />
        </div>
      </header>
      <ProductDetailNav
        sections={product.sections.map((section) => ({
          id: section.anchor,
          label: section.label,
        }))}
        hasRelated={related.length > 0}
      />
      {product.sections.map((section) => {
        const titleId = `product-section:${section.anchor}:title`
        const hasHeader = Boolean(section.title || section.description)
        return (
          <section
            key={section.anchor}
            id={section.anchor}
            className={styles.section}
            data-website-theme={section.theme}
            data-flush-start={(!hasHeader && isFullBleed(section.blocks[0])) || undefined}
            data-flush-end={isFullBleed(section.blocks.at(-1)) || undefined}
            aria-labelledby={section.title ? titleId : undefined}
            aria-label={section.title ? undefined : section.label}
          >
            {(section.title || section.description) && (
              <Entrance as="header" className={`${styles.sectionHeader} site-container`}>
                {section.title && (
                  <h2 id={titleId} className="website-type-heading-1">
                    {section.title}
                  </h2>
                )}
                {section.description && (
                  <p className="website-type-excerpt">{section.description}</p>
                )}
              </Entrance>
            )}
            {section.blocks.length > 0 && (
              <div className={styles.sectionBlocks}>
                <RenderProductBlocks blocks={section.blocks} />
              </div>
            )}
          </section>
        )
      })}
      {related.length > 0 && (
        <section id="related-products" className={styles.related}>
          <OverflowCarousel
            title="You may also need"
            href={productCategoryPath(category)}
            linkLabel="View more"
          >
            {related.map((item) => (
              <ProductCard key={item.id} product={item} showAction />
            ))}
          </OverflowCarousel>
        </section>
      )}
    </article>
  )
}
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category, product: slug, lang = 'en' } = await params
  const { isEnabled: draft } = await draftMode()
  const product = await getProductBySlug(slug, { draft, locale: lang })
  if (!product) return { robots: { index: false, follow: false } }
  if (product.categorySlug !== category) notFound()
  const title = product.meta.title?.trim() || product.title
  const description = product.meta.description?.trim() || product.summary
  const canonical = productPath(category, product.slug)
  const image = product.meta.image?.url
  const identity = await getSiteIdentity({ locale: lang })
  return localizeMetadata(
    {
      title,
      description,
      twitter: null,
      alternates: { canonical },
      openGraph: mergeOpenGraph(identity, {
        title,
        description: description ?? undefined,
        url: canonical,
        images: image ? [{ url: new URL(image, getServerSideURL()).toString() }] : undefined,
      }),
      ...(draft ? { robots: { index: false, follow: false } } : {}),
    },
    { path: canonical, locale: lang, sourceCollection: 'products', sourceId: product.id, draft },
  )
}
