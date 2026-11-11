import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { HeaderThemeSync } from '@/heros/HeaderThemeSync'
import { ProductDetailNav } from '@/components/Products/ProductDetailNav'
import { OverflowCarousel } from '@/components/Products/OverflowCarousel'
import { ProductCard } from '@/components/Products/ProductCard'
import { ProductGallery } from '@/components/Products/ProductGallery'
import { ProductTabs } from '@/components/Products/ProductTabs'
import { ProductActions } from '@/components/Products/ProductActions'
import { RenderProductBlocks } from '@/collections/Products/blocks/RenderProductBlocks'
import { getProductBySlug } from '@/utilities/products/getProductBySlug'
import { getRelatedProducts } from '@/utilities/products/getRelatedProducts'
import { getProductStaticParams } from '@/utilities/products/getProductStaticParams'
import { productCategoryPath, productPath } from '@/utilities/products/paths'
import { getServerSideURL } from '@/utilities/getURL'
import { mergeOpenGraph } from '@/utilities/mergeOpenGraph'
import styles from './page.module.css'

type Args = { params: Promise<{ category: string; product: string }> }
export async function generateStaticParams() {
  return (await getProductStaticParams()).products
}
export default async function ProductPage({ params }: Args) {
  const { category, product: slug } = await params
  const { isEnabled: draft } = await draftMode()
  const product = await getProductBySlug(slug, { draft })
  const url = productPath(category, slug)
  if (!product) return <PayloadRedirects url={url} />
  if (product.categorySlug !== category) notFound()
  const related = await getRelatedProducts(product)

  return (
    <article className={styles.root}>
      <HeaderThemeSync theme="light" />
      <PayloadRedirects disableNotFound url={url} />
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
            product={{ title: product.title, slug: product.slug }}
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
      {product.sections.map((section) => (
        <section key={section.anchor} id={section.anchor} className={styles.section}>
          <RenderProductBlocks blocks={section.blocks} />
        </section>
      ))}
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
  const { category, product: slug } = await params
  const { isEnabled: draft } = await draftMode()
  const product = await getProductBySlug(slug, { draft })
  if (!product) return { robots: { index: false, follow: false } }
  if (product.categorySlug !== category) notFound()
  const title = product.meta.title ?? product.title
  const description = product.meta.description ?? product.summary
  const canonical = productPath(category, product.slug)
  const image = product.meta.image?.url
  return {
    title,
    description,
    twitter: null,
    alternates: { canonical },
    openGraph: mergeOpenGraph({
      title,
      description: description ?? undefined,
      url: canonical,
      images: image ? [{ url: new URL(image, getServerSideURL()).toString() }] : undefined,
    }),
    ...(draft ? { robots: { index: false, follow: false } } : {}),
  }
}
