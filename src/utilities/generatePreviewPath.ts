import { PreviewSearchParams } from '@/app/(frontend)/next/preview/route'
import { PayloadRequest, CollectionSlug } from 'payload'
import { getContentPath } from '@/utilities/getContentPath'

type Props = {
  collection: CollectionSlug
  slug: string
  categorySlug?: string | null
  req: PayloadRequest
}

export const generatePreviewPath = ({ collection, slug, categorySlug }: Props) => {
  const path = getContentPath(collection, slug, { categorySlug })
  if (!path) {
    return null
  }

  const encodedParams = new URLSearchParams({
    path,
    previewSecret: process.env.PREVIEW_SECRET || '',
  } satisfies PreviewSearchParams)

  const url = `/next/preview?${encodedParams.toString()}`

  return url
}
