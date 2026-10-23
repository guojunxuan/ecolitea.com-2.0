import { describe, expect, it } from 'vitest'
import type { PayloadRequest } from 'payload'

import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { getContentPath } from '@/utilities/getContentPath'
import {
  productCategoryPath,
  productPath,
  productsOverviewPath,
} from '@/utilities/products/paths'

describe('product paths', () => {
  it('builds overview, category, and paginated category paths', () => {
    expect(productsOverviewPath).toBe('/products')
    expect(productCategoryPath('tea')).toBe('/products/tea')
    expect(productCategoryPath('tea', 2)).toBe('/products/tea/page/2')
  })

  it('encodes category and product slugs', () => {
    expect(productCategoryPath('green tea')).toBe('/products/green%20tea')
    expect(productPath('green tea', 'sencha/first')).toBe('/products/green%20tea/sencha%2Ffirst')
  })

  it('resolves product documents only when their category slug is available', () => {
    expect(getContentPath('products', 'sencha', { categorySlug: 'green-tea' }))
      .toBe('/products/green-tea/sencha')
    expect(getContentPath('products', 'sencha')).toBeNull()
    expect(getContentPath('products', 'sencha', { categorySlug: null })).toBeNull()
    expect(getContentPath('product-categories', 'green-tea')).toBe('/products/green-tea')
  })

  it('keeps existing collection paths unchanged', () => {
    expect(getContentPath('pages', 'about')).toBe('/about')
    expect(getContentPath('posts', 'news')).toBe('/posts/news')
    expect(getContentPath('blogs', 'tea')).toBe('/blogs/tea')
    expect(getContentPath('blog-categories', 'brewing')).toBe('/blogs/category/brewing')
    expect(getContentPath('case-studies', 'client')).toBe('/case-studies/client')
  })

  it('uses the nested product path in preview query parameters', () => {
    const preview = generatePreviewPath({
      collection: 'products',
      slug: 'sencha',
      categorySlug: 'green-tea',
      req: {} as PayloadRequest,
    })
    expect(new URL(preview!, 'https://example.test').searchParams.get('path'))
      .toBe('/products/green-tea/sencha')
  })
})
