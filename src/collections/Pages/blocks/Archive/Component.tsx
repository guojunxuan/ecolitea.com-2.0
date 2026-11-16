import { getLocalizedList, readyTranslationFilter } from '@/utilities/i18n/getLocalized'
import type { Post, PageArchiveBlock as ArchiveBlockProps } from '@/payload-types'

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
> = async (props) => {
  const {
    id,
    categories,
    introContent,
    limit: limitFromProps,
    populateBy,
    selectedDocs,
    locale = 'en',
  } = props

  const limit = limitFromProps || 3

  let posts: Post[] = []

  if (populateBy === 'collection') {
    const payload = await getPayload({ config: configPromise })

    const flattenedCategories = categories?.map((category) => {
      if (typeof category === 'object') return category.id
      else return category
    })

    const fetchedPosts = await payload.find({
      collection: 'posts',
      depth: 1,
      limit,
      ...(locale !== 'en'
        ? {
            draft: false,
            overrideAccess: false,
            where: {
              and: [
                ...(await readyTranslationFilter(payload, 'posts', locale)),
                ...(flattenedCategories?.length
                  ? [{ categories: { in: flattenedCategories } }]
                  : []),
              ],
            },
          }
        : {}),
      ...(locale === 'en' && flattenedCategories && flattenedCategories.length > 0
        ? {
            where: {
              categories: {
                in: flattenedCategories,
              },
            },
          }
        : {}),
    })

    posts = await getLocalizedList(fetchedPosts.docs, 'posts', locale, payload)
  } else {
    if (selectedDocs?.length) {
      const filteredSelectedPosts = selectedDocs.map((post) => {
        if (typeof post.value === 'object') return post.value
      }) as Post[]

      posts = filteredSelectedPosts
    }
  }

  return (
    <div id={`block-${id}`}>
      {introContent && (
        <div className={styles.intro}>
          <RichText className={styles.introText} data={introContent} enableGutter={false} />
        </div>
      )}
      <CollectionArchive posts={posts} />
    </div>
  )
}
