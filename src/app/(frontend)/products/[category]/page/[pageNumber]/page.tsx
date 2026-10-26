import type { Metadata } from 'next'
import { parsePageNumber, productListingMetadata, renderProductListing } from '../../listing'
export const dynamic = 'force-static'
export const revalidate = 600
type Args = { params: Promise<{ category: string; pageNumber: string }> }
export async function generateStaticParams() {
  return []
}
export default async function Page({ params }: Args) {
  const { category, pageNumber } = await params
  return renderProductListing({ categorySlug: category, page: parsePageNumber(pageNumber) })
}
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category, pageNumber } = await params
  return productListingMetadata({ categorySlug: category, page: parsePageNumber(pageNumber) })
}
