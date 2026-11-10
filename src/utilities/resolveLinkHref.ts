import type {
  Blog,
  BlogCategory,
  CaseStudy,
  Category,
  Page,
  Post,
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
      relationTo: 'posts'
      value: Post | string | number
    }
  | {
      relationTo: 'case-studies'
      value: CaseStudy | string | number
    }
  | {
      relationTo: 'categories'
      value: Category | string | number
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

export const resolveLinkHref = ({ reference, type, url }: ResolvableLink): string | null => {
  if (type !== 'reference') return url || null
  if (!reference || !reference.value || typeof reference.value !== 'object') return null

  const slug = reference.value.slug

  if (!slug) return null

  if (reference.relationTo === 'categories') return `/posts?category=${encodeURIComponent(slug)}`
  return getContentPath(
    reference.relationTo,
    slug,
    reference.relationTo === 'products'
      ? { categorySlug: reference.value.categorySlug }
      : undefined,
  )
}
