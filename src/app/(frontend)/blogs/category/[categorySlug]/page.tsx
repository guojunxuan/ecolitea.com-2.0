import type { Metadata } from 'next'
import {
  blogListingMetadata,
  getCategoryStaticParams,
  renderBlogListing,
  type BlogSearchParams,
} from '../../listing'

export const dynamic = 'force-dynamic'

type Args = { params: Promise<{ categorySlug: string }>; searchParams?: Promise<BlogSearchParams> }

export const generateStaticParams = getCategoryStaticParams

export default async function Page({ params, searchParams }: Args) {
  const { categorySlug } = await params
  return renderBlogListing({ page: 1, categorySlug, searchParams: await searchParams })
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { categorySlug } = await params
  return blogListingMetadata({ page: 1, categorySlug })
}
