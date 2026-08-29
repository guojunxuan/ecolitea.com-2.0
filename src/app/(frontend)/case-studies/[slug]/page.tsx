import type { Metadata } from 'next'
import { cache } from 'react'
import { draftMode } from 'next/headers'
import { getPayload } from 'payload'
import configPromise from '@payload-config'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import { LivePreviewListener } from '@/components/LivePreviewListener'
import { generateMeta } from '@/utilities/generateMeta'
import { RenderBlocks } from '@/blocks/RenderBlocks'

type Args = { params: Promise<{ slug?: string }> }
const queryCaseStudy = cache(async (slug: string) => {
  const { isEnabled: draft } = await draftMode()
  const payload = await getPayload({ config: configPromise })
  const result = await payload.find({ collection: 'case-studies', draft, overrideAccess: draft, depth: 2, limit: 1, pagination: false, where: { slug: { equals: slug } } })
  return result.docs?.[0] || null
})

export default async function CaseStudy({ params }: Args) {
  const { slug = '' } = await params
  const doc = await queryCaseStudy(decodeURIComponent(slug))
  const url = `/case-studies/${slug}`
  if (!doc) return <PayloadRedirects url={url} />
  const { isEnabled: draft } = await draftMode()
  return <article><PayloadRedirects disableNotFound url={url} />{draft && <LivePreviewListener />}<h1>{doc.title}</h1>{doc.layout && <RenderBlocks blocks={doc.layout} />}</article>
}

export async function generateMetadata({ params }: Args): Promise<Metadata> {
  const { slug = '' } = await params
  return generateMeta({ doc: await queryCaseStudy(decodeURIComponent(slug)) })
}
