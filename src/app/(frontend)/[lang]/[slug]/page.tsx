import { readySourceIDs } from '@/utilities/i18n/seo'
import { getDocumentBySlug } from '@/utilities/i18n/getDocumentBySlug'
import { enforceLegalLocale, fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import type { Metadata } from 'next'

import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'
import { draftMode } from 'next/headers'
import React from 'react'

import { RenderPageBlocks } from '@/collections/Pages/blocks/RenderPageBlocks'
import { RenderHero } from '@/heros/RenderHero'
import { generateMeta } from '@/utilities/generateMeta'
import { LivePreviewListener } from '@/components/LivePreviewListener'

export async function generateStaticParams(options?: { params: { lang: string } }) {
  const locale = options?.params.lang ?? 'en'
  const payload = await getPayload({ config: configPromise })
  const pages = await payload.find({
    collection: 'pages',
    draft: false,
    limit: 1000,
    overrideAccess: false,
    pagination: false,
    select: {
      slug: true,
    },
  })

  const ready = await readySourceIDs(
    payload,
    'pages',
    pages.docs.map((doc) => String(doc.id)),
    locale,
  )

  const params = pages.docs
    ?.filter((doc) => {
      return doc.slug !== 'home' && ready.has(String(doc.id))
    })
    .map(({ slug }) => {
      return { slug }
    })

  return params
}

type Args = {
  params: Promise<{ lang: string; slug?: string }>
}

export default async function Page({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = 'home', lang = 'en' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = decodedSlug === 'home' ? '/' : '/' + decodedSlug
  await enforceLegalLocale(url, lang)
  const page: RequiredDataFromCollectionSlug<'pages'> | null = await queryPageBySlug({
    slug: decodedSlug,
    locale: lang,
  })

  await fallbackToEnglish(page, lang, url, () => queryPageBySlug({ slug: decodedSlug }))
  if (!page) {
    return <PayloadRedirects locale={lang} url={url} />
  }

  const { hero, layout } = page

  return (
    <article>
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects locale={lang} disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <RenderHero {...hero} />
      <RenderPageBlocks blocks={layout} />
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = 'home', lang = 'en' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const page = await queryPageBySlug({
    slug: decodedSlug,
    locale: lang,
  })

  return generateMeta({
    doc: page,
    locale: lang,
    path: decodedSlug === 'home' ? '/' : `/${decodedSlug}`,
    sourceCollection: 'pages',
    draft: (await draftMode()).isEnabled,
  })
}

const queryPageBySlug = async ({ slug, locale = 'en' }: { slug: string; locale?: string }) => {
  const { isEnabled: draft } = await draftMode()
  return getDocumentBySlug('pages', slug, locale, draft)
}
