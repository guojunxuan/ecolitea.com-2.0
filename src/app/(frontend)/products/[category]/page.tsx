import type { Metadata } from 'next'
import { getProductStaticParams } from '@/utilities/products/getProductStaticParams'
import { productListingMetadata, renderProductListing } from './listing'
export const dynamic = 'force-static'
export const revalidate = 600
type Args = { params: Promise<{ category: string }> }
export async function generateStaticParams() {
  return (await getProductStaticParams()).categories.map((category) => ({ category }))
}
export default async function Page({ params }: Args) {
  const { category } = await params
  return renderProductListing({ categorySlug: category, page: 1 })
}
export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { category } = await params
  return productListingMetadata({ categorySlug: category, page: 1 })
}
