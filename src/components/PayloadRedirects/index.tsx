import type React from 'react'
import type { Blog, Page, Post } from '@/payload-types'

import { getCachedDocument } from '@/utilities/getDocument'
import { getCachedRedirects } from '@/utilities/getRedirects'
import { getContentPath } from '@/utilities/getContentPath'
import configPromise from '@payload-config'
import { getPayload } from 'payload'
import { notFound, permanentRedirect, redirect } from 'next/navigation'

interface Props {
  disableNotFound?: boolean
  url: string
}

/* This component helps us with SSR based dynamic redirects */
export const PayloadRedirects: React.FC<Props> = async ({ disableNotFound, url }) => {
  const redirects = await getCachedRedirects()()

  const redirectItem = redirects.find((redirect) => redirect.from === url)

  if (redirectItem) {
    if (redirectItem.to?.url) {
      redirect(redirectItem.to.url)
    }

    const reference = redirectItem.to?.reference
    if (reference) {
      const collection = reference.relationTo
      let document = typeof reference.value === 'object' ? reference.value : null

      if (typeof reference.value === 'string') {
        if (collection === 'blogs') {
          const payload = await getPayload({ config: configPromise })
          document = await payload.findByID({
            collection: 'blogs',
            id: reference.value,
            depth: 0,
            disableErrors: true,
          })
        } else {
          document = (await getCachedDocument(collection, reference.value)()) as Page | Post
        }
      }

      const redirectUrl = getContentPath(collection, (document as Blog | Page | Post | null)?.slug || '')
      if (redirectUrl) {
        if (collection === 'blogs') permanentRedirect(redirectUrl)
        redirect(redirectUrl)
      }
    }
  }

  if (disableNotFound) return null

  notFound()
}
