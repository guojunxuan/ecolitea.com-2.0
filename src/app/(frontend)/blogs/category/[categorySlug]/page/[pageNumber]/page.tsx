import type { Metadata } from 'next'
import { blogListingMetadata, parsePageNumber, renderBlogListing } from '../../../../listing'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = {
  params: Promise<{ categorySlug: string; pageNumber: string }>
}

export async function generateStaticParams() {
  return []
}

export default async function Page({ params }: Args) {
  const { categorySlug, pageNumber } = await params
  return renderBlogListing({
    page: parsePageNumber(pageNumber),
    categorySlug,
  })
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { categorySlug, pageNumber } = await params
  return blogListingMetadata({ page: parsePageNumber(pageNumber), categorySlug })
}
