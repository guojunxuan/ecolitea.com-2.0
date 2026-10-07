import type { Metadata } from 'next'
import { blogListingMetadata, renderBlogListing } from './listing'

export const dynamic = 'force-static'
export const revalidate = 600

export default function Page() {
  return renderBlogListing({ page: 1 })
}

export function generateMetadata(): Promise<Metadata> {
  return blogListingMetadata({ page: 1 })
}
