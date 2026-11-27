import type { Metadata } from 'next'
import { blogListingMetadata, getCategoryStaticParams, renderBlogListing } from '../../listing'

export const dynamic = 'force-static'
export const revalidate = 600

type Args = { params: Promise<{ lang: string; categorySlug: string }> }

export const generateStaticParams = getCategoryStaticParams

export default async function Page({ params }: Args) {
  const { categorySlug, lang = 'en' } = await params
  return renderBlogListing({ locale: lang, page: 1, categorySlug })
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { categorySlug, lang = 'en' } = await params
  return blogListingMetadata({ locale: lang, page: 1, categorySlug })
}
