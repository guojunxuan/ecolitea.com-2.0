import type { Metadata } from 'next'
import { getProductStaticParams } from '@/utilities/products/getProductStaticParams'
import { productListingMetadata, renderProductListing } from './listing'
export const dynamic = 'force-static'
export const revalidate = 600
type Args = { params: Promise<{ lang: string; category: string }> }
export async function generateStaticParams() {
  return (await getProductStaticParams()).categories.map((category) => ({ category }))
}
export default async function Page({ params }: Args) {
  const { category, lang = 'en' } = await params
  return renderProductListing({ locale: lang, categorySlug: category, page: 1 })
}
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category, lang = 'en' } = await params
  return productListingMetadata({ locale: lang, categorySlug: category, page: 1 })
}
