import { getDocumentBySlug } from '@/utilities/i18n/getDocumentBySlug'
import { fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { generateMeta } from '@/utilities/generateMeta'
import { RenderCaseStudyBlocks } from '@/collections/CaseStudies/blocks/RenderCaseStudyBlocks'

type Args = { params: Promise<{ lang: string; slug?: string }> }
const queryCaseStudy = async (slug: string, locale = 'en') => {
  const { isEnabled: draft } = await draftMode()
  return getDocumentBySlug('case-studies', slug, locale, draft)
}

export default async function CaseStudy({ params }: Args) {
  const { slug = '', lang = 'en' } = await params
  const doc = await queryCaseStudy(decodeURIComponent(slug), lang)
  const url = `/case-studies/${slug}`
  await fallbackToEnglish(doc, lang, url, () => queryCaseStudy(decodeURIComponent(slug)))
  if (!doc) return <PayloadRedirects locale={lang} url={url} />
  const { isEnabled: draft } = await draftMode()
  return <article><PayloadRedirects locale={lang} disableNotFound url={url} />{draft && <LivePreviewListener />}<h1>{doc.title}</h1>{doc.layout && <RenderCaseStudyBlocks blocks={doc.layout} />}</article>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug = '', lang = 'en' } = await params
  return generateMeta({ doc: await queryCaseStudy(decodeURIComponent(slug), lang) })
}
