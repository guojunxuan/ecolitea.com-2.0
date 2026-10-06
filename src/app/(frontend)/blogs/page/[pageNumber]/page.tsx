import type { Metadata } from 'next'
import {
  blogListingMetadata,
  parsePageNumber,
  renderBlogListing,
  type BlogSearchParams,
} from '../../listing'

export const dynamic = 'force-dynamic'

type Args = { params: Promise<{ pageNumber: string }>; searchParams?: Promise<BlogSearchParams> }

export async function generateStaticParams() {
  return []
}

export default async function Page({ params, searchParams }: Args) {
  const { pageNumber } = await params
  return renderBlogListing({ page: parsePageNumber(pageNumber), searchParams: await searchParams })
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { pageNumber } = await params
  return blogListingMetadata({ page: parsePageNumber(pageNumber) })
}
