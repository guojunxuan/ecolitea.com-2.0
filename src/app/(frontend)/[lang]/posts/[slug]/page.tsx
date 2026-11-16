import { readySourceIDs } from '@/utilities/i18n/seo'
import { getDocumentBySlug } from '@/utilities/i18n/getDocumentBySlug'
import { fallbackToEnglish } from '@/utilities/i18n/pageAccess'
import { postRichTextBlocks } from '@/collections/Posts/blocks/richTextBlocks'
import type { Metadata } from 'next'

import { RelatedPosts } from '@/blocks/RelatedPosts/Component'
import { PayloadRedirects } from '@/components/PayloadRedirects'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { draftMode } from 'next/headers'
import React from 'react'
import RichText from '@/components/RichText'

import type { Post } from '@/payload-types'

import { PostHero } from '@/heros/PostHero'
import { generateMeta } from '@/utilities/generateMeta'
import { LivePreviewListener } from '@/components/LivePreviewListener'

import styles from '../../pages.module.css'

export async function generateStaticParams(options: { params: { lang: string } }) {
  const locale = options?.params.lang ?? 'en'
  const payload = await getPayload({ config: configPromise })
  const posts = await payload.find({
    collection: 'posts',
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
    'posts',
    posts.docs.map((doc) => String(doc.id)),
    locale,
  )

  const params = posts.docs
    .filter((doc) => ready.has(String(doc.id)))
    .map(({ slug }) => {
      return { slug }
    })

  return params
}

type Args = {
  params: Promise<{ lang: string; slug?: string }>
}

export default async function Post({ params: paramsPromise }: Args) {
  const { isEnabled: draft } = await draftMode()
  const { slug = '', lang = 'en' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const url = '/posts/' + decodedSlug
  const post = await queryPostBySlug({ slug: decodedSlug, locale: lang })

  await fallbackToEnglish(post, lang, url, () => queryPostBySlug({ slug: decodedSlug }))
  if (!post) return <PayloadRedirects locale={lang} url={url} />

  return (
    <article className={styles.post}>
      {/* Allows redirects for valid pages too */}
      <PayloadRedirects locale={lang} disableNotFound url={url} />

      {draft && <LivePreviewListener />}

      <PostHero post={post} />

      <div className={styles.postContent}>
        <RichText blocks={postRichTextBlocks} data={post.content} enableGutter={false} />
        {post.relatedPosts && post.relatedPosts.length > 0 && (
          <RelatedPosts
            className={styles.relatedPosts}
            docs={post.relatedPosts.filter((post) => typeof post === 'object')}
          />
        )}
      </div>
    </article>
  )
}

export async function generateMetadata({ params: paramsPromise }: Args): Promise<Metadata> {
  const { slug = '', lang = 'en' } = await paramsPromise
  // Decode to support slugs with special characters
  const decodedSlug = decodeURIComponent(slug)
  const post = await queryPostBySlug({ slug: decodedSlug, locale: lang })

  return generateMeta({
    doc: post,
    locale: lang,
    path: `/posts/${decodedSlug}`,
    sourceCollection: 'posts',
    draft: (await draftMode()).isEnabled,
  })
}

const queryPostBySlug = async ({ slug, locale = 'en' }: { slug: string; locale?: string }) => {
  const { isEnabled: draft } = await draftMode()
  return getDocumentBySlug('posts', slug, locale, draft)
}
