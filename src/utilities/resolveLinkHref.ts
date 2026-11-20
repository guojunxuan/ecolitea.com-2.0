import { localePath } from '@/i18n/paths'
import type {
  Blog,
  BlogCategory,
  CaseStudy,
  Page,
  Product,
  ProductCategory,
} from '@/payload-types'
import { getContentPath } from '@/utilities/getContentPath'

type LinkRelation =
  | { relationTo: 'products'; value: Product | string | number }
  | { relationTo: 'product-categories'; value: ProductCategory | string | number }
  | {
      relationTo: 'pages'
      value: Page | string | number
    }
  | {
      relationTo: 'case-studies'
      value: CaseStudy | string | number
    }
  | {
      relationTo: 'blogs'
      value: Blog | string | number
    }
  | {
      relationTo: 'blog-categories'
      value: BlogCategory | string | number
    }

export type CMSLinkDestination = {
  label?: string | null
  newTab?: boolean | null
  reference?: LinkRelation | null
  type?: 'custom' | 'reference' | null
  url?: string | null
}

type ResolvableLink = Pick<CMSLinkDestination, 'reference' | 'type' | 'url'>

export const resolveLinkHref = ({ reference, type, url }: ResolvableLink, locale = 'en'): string | null => {
  if (type !== 'reference') return url ? localePath(url, locale) : null
  if (!reference || !reference.value || typeof reference.value !== 'object') return null

  const slug = reference.value.slug

  if (!slug) return null

  return getContentPath(
    reference.relationTo,
    slug,
    reference.relationTo === 'products'
      ? { categorySlug: reference.value.categorySlug, locale }
      : { locale },
  )
}
