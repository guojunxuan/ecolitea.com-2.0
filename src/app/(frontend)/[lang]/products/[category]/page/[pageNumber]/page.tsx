import type { Metadata } from 'next'
import { parsePageNumber, productListingMetadata, renderProductListing } from '../../listing'
export const dynamic = 'force-static'
export const revalidate = 600
type Args = { params: Promise<{ lang: string; category: string; pageNumber: string }> }
export async function generateStaticParams() {
  return []
}
export default async function Page({ params }: Args) {
  const { category, pageNumber, lang = 'en' } = await params
  return renderProductListing({ locale: lang, categorySlug: category, page: parsePageNumber(pageNumber) })
}
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category, pageNumber, lang = 'en' } = await params
  return productListingMetadata({ locale: lang, categorySlug: category, page: parsePageNumber(pageNumber) })
}
