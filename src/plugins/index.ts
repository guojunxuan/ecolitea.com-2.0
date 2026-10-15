import { formBuilderPlugin } from '@payloadcms/plugin-form-builder'
import { nestedDocsPlugin } from '@payloadcms/plugin-nested-docs'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { seoPlugin } from '@payloadcms/plugin-seo'
import { searchPlugin } from '@payloadcms/plugin-search'
import type { CollectionSlug, Plugin } from 'payload'
import { revalidateRedirects } from '@/hooks/revalidateRedirects'
import {
  GenerateDescription,
  GenerateImage,
  GenerateTitle,
  GenerateURL,
} from '@payloadcms/plugin-seo/types'
import { FixedToolbarFeature, HeadingFeature, lexicalEditor } from '@payloadcms/richtext-lexical'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { publicSearchVisibility } from '@/search/visibility'

import { Blog, CaseStudy, Page, Post, Settings } from '@/payload-types'
import { getServerSideURL } from '@/utilities/getURL'
import { getContentPath } from '@/utilities/getContentPath'
import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'
import { s3Storage, type S3StorageOptions } from '@payloadcms/storage-s3'
import { serverEnv } from '@/utilities/env'

type SEOContent = Blog | CaseStudy | Page | Post

export const generateTitle: GenerateTitle<SEOContent | Settings> = ({
  collectionConfig,
  globalConfig,
  doc,
}) => {
  if (globalConfig?.slug === 'settings') return 'Blogs'
  const content = doc as SEOContent
  if (collectionConfig?.slug === 'blogs') {
    return content?.title ? `${content.title} | Ecolitea` : 'Ecolitea'
  }
  return content?.title ? `${content.title} | Payload Website Template` : 'Payload Website Template'
}

export const generateDescription: GenerateDescription<SEOContent | Settings> = ({
  collectionConfig,
  globalConfig,
  doc,
}) => {
  if (globalConfig?.slug === 'settings')
    return 'Explore our latest blog articles, insights, and guides.'
  const content = doc as SEOContent
  if (collectionConfig?.slug === 'blogs') return (content as Blog)?.excerpt || ''
  return content?.meta?.description || ''
}

export const generateURL: GenerateURL<SEOContent | Settings> = ({
  collectionConfig,
  globalConfig,
  doc,
}) => {
  const url = getServerSideURL()
  if (globalConfig?.slug === 'settings') return new URL('/blogs', url).toString()
  const content = doc as SEOContent
  const path =
    collectionConfig?.slug && content?.slug
      ? getContentPath(collectionConfig.slug as CollectionSlug, content.slug)
      : null
  return path ? `${url}${path}` : url
}

const mediaID = (value: unknown): string | number | undefined => {
  if (value === '' || value === 0) return undefined
  if (typeof value === 'string' || typeof value === 'number') return value
  if (value && typeof value === 'object' && 'id' in value) {
    const id = value.id
    if ((typeof id === 'string' && id !== '') || (typeof id === 'number' && id !== 0)) return id
  }
  return undefined
}

export const generateImage: GenerateImage<SEOContent | Settings> = async ({
  collectionConfig,
  globalConfig,
  doc,
  req,
}) => {
  let source: unknown
  let current: unknown

  if (globalConfig?.slug === 'settings') {
    const blog = (doc as Settings)?.blog
    source = blog?.hero?.image
    current = blog?.seo?.image
  } else {
    const content = doc as SEOContent
    current = content?.meta?.image
    switch (collectionConfig?.slug) {
      case 'blogs':
      case 'posts':
        source = (content as Blog | Post)?.heroImage
        break
      case 'pages':
      case 'case-studies': {
        const hero = (content as Page | CaseStudy)?.hero
        if (hero?.type === 'highImpact' || hero?.type === 'mediumImpact') source = hero.media
        break
      }
    }
  }

  const fallback = mediaID(current) ?? ''
  const id = mediaID(source)
  if (id === undefined) return fallback

  try {
    const media = await req.payload.findByID({
      collection: 'media',
      id: String(id),
      depth: 0,
      overrideAccess: false,
      req,
    })
    return media?.mimeType &&
      MEDIA_UPLOAD_POLICY.image.mimeTypes.some((type) => type === media.mimeType)
      ? id
      : fallback
  } catch (error) {
    const status = (error as { status?: number })?.status
    if (status === 403 || status === 404) return fallback
    throw error
  }
}

export const generateR2FileURL = ({ filename, prefix }: { filename: string; prefix?: string }) =>
  `${serverEnv.R2_PUBLIC_URL}/${prefix ? `${prefix}/` : ''}${filename}`

const r2CollectionOptions = {
  disablePayloadAccessControl: true,
  generateFileURL: generateR2FileURL,
} as const

export const r2StorageCollections = {
  media: r2CollectionOptions,
  'site-assets': r2CollectionOptions,
} satisfies S3StorageOptions['collections']

export const plugins: Plugin[] = [
  s3Storage({
    enabled: process.env.DISABLE_R2_STORAGE !== 'true',
    collections: r2StorageCollections,
    bucket: serverEnv.R2_BUCKET,
    config: {
      credentials: {
        accessKeyId: serverEnv.R2_ACCESS_KEY_ID,
        secretAccessKey: serverEnv.R2_SECRET_ACCESS_KEY,
      },
      endpoint: serverEnv.R2_ENDPOINT,
      forcePathStyle: true,
      region: 'auto',
    },
  }).init as unknown as Plugin,
  redirectsPlugin({
    collections: ['pages', 'posts', 'blogs'],
    overrides: {
      // @ts-expect-error - This is a valid override, mapped fields don't resolve to the same type
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'from') {
            return {
              ...field,
              admin: {
                description: 'You will need to rebuild the website when changing this field.',
              },
            }
          }
          return field
        })
      },
      hooks: {
        afterChange: [revalidateRedirects],
      },
    },
  }),
  nestedDocsPlugin({
    collections: ['categories'],
    generateURL: (docs) => docs.reduce((url, doc) => `${url}/${doc.slug}`, ''),
  }),
  seoPlugin({
    generateTitle,
    generateURL,
    generateDescription,
    generateImage,
  }),
  formBuilderPlugin({
    fields: {
      payment: false,
    },
    formOverrides: {
      fields: ({ defaultFields }) => {
        return defaultFields.map((field) => {
          if ('name' in field && field.name === 'confirmationMessage') {
            return {
              ...field,
              editor: lexicalEditor({
                features: ({ rootFeatures }) => {
                  return [
                    ...rootFeatures,
                    FixedToolbarFeature(),
                    HeadingFeature({ enabledHeadingSizes: ['h1', 'h2', 'h3', 'h4'] }),
                  ]
                },
              }),
            }
          }
          return field
        })
      },
    },
  }),
  searchPlugin({
    collections: ['posts', 'blogs'],
    beforeSync: beforeSyncWithSearch,
    searchOverrides: {
      access: { read: () => publicSearchVisibility(new Date()) },
      fields: ({ defaultFields }) => {
        return [...defaultFields, ...searchFields]
      },
    },
  }),
]
