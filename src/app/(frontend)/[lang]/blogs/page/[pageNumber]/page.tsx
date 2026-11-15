import type { Metadata } from 'next'
import { blogListingMetadata, parsePageNumber, renderBlogListing } from '../../listing'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = { params: Promise<{ lang: string; pageNumber: string }> }

export async function generateStaticParams() {
  return []
}

export default async function Page({ params }: Args) {
  const { pageNumber, lang = 'en' } = await params
  return renderBlogListing({ locale: lang, page: parsePageNumber(pageNumber) })
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { pageNumber, lang = 'en' } = await params
  return blogListingMetadata({ locale: lang, page: parsePageNumber(pageNumber) })
}
