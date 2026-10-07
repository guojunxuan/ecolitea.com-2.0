import type { Metadata } from 'next'
import { blogListingMetadata, getCategoryStaticParams, renderBlogListing } from '../../listing'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = { params: Promise<{ categorySlug: string }> }

export const generateStaticParams = getCategoryStaticParams

export default async function Page({ params }: Args) {
  const { categorySlug } = await params
  return renderBlogListing({ page: 1, categorySlug })
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { categorySlug } = await params
  return blogListingMetadata({ page: 1, categorySlug })
}
