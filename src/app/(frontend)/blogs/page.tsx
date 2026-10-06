import type { Metadata } from 'next'
import { blogListingMetadata, renderBlogListing, type BlogSearchParams } from './listing'

export const dynamic = 'force-dynamic'

export default async function Page({
  searchParams,
}: { searchParams?: Promise<BlogSearchParams> }) {
  return renderBlogListing({ page: 1, searchParams: await searchParams })
}

export function generateMetadata(): Promise<Metadata> {
  return blogListingMetadata({ page: 1 })
}
