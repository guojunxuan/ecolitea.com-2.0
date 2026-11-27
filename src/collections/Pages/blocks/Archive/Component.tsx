import { getLocalizedList, readyTranslationFilter } from '@/utilities/i18n/getLocalized'
import { isPublicSource } from '@/utilities/i18n/publicSourceVisibility'
import { publicBlogVisibility } from '@/utilities/blogs/publicVisibility'
import type { Blog, PageArchiveBlock as ArchiveBlockProps } from '@/payload-types'

import configPromise from '@payload-config'
import { getPayload } from 'payload'
import React from 'react'
import RichText from '@/components/RichText'

import { CollectionArchive } from '@/components/CollectionArchive'
import styles from './Component.module.css'

export const ArchiveBlock: React.FC<
  ArchiveBlockProps & {
    id?: string
    locale?: string
  }
> = async ({ id, categories, introContent, limit, populateBy, selectedDocs, locale = 'en' }) => {
  const now = new Date()
  let blogs: Blog[]

  if (populateBy === 'selection') {
    blogs = (selectedDocs ?? []).flatMap((selection) => {
      if (selection?.relationTo !== 'blogs') return []
      const { value } = selection
      if (!value || typeof value !== 'object') return []
      return isPublicSource({ _status: value._status, publishedAt: value.publishedAt }, 'blogs', now)
        ? [value]
        : []
    })
  } else {
    const payload = await getPayload({ config: configPromise })
    const categoryIDs = (categories ?? []).filter(Boolean).map((category) =>
      typeof category === 'object' ? category.id : category,
    )
    const { docs } = await payload.find({
      collection: 'blogs',
      draft: false,
      overrideAccess: false,
      depth: 1,
      limit: limit || 3,
      sort: '-publishedAt',
      where: {
        and: [
          publicBlogVisibility(now),
          ...(locale === 'en' ? [] : await readyTranslationFilter(payload, 'blogs', locale)),
          ...(categoryIDs.length ? [{ category: { in: categoryIDs } }] : []),
        ],
      },
    })
    blogs = await getLocalizedList(docs, 'blogs', locale, payload)
  }

  return (
    <div id={`block-${id}`}>
      {introContent && (
        <div className={styles.intro}>
          <RichText className={styles.introText} data={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive posts={blogs} relationTo="blogs" />
    </div>
  )
}
