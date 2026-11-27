import type { Metadata } from 'next'
import { blogListingMetadata, renderBlogListing } from './listing'

export const dynamic = 'force-static'
export const revalidate = 600

export default async function Page({ params }: { params?: Promise<{ lang: string }> }) {
  const { lang = 'en' } = await params ?? {}
  return renderBlogListing({ page: 1, locale: lang })
}

export async function generateMetadata({ params }: { params?: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang = 'en' } = await params ?? {}
  return blogListingMetadata({ page: 1, locale: lang })
}
