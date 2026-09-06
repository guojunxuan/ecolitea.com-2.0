import { cleanup, render } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import { CMSLink, resolveLinkHref, type CMSLinkType } from '@/components/Link'
import type { CaseStudy, Category, Page, Post } from '@/payload-types'

const documentWithSlug = <T,>(slug: string): T => ({ slug }) as T

afterEach(cleanup)

describe('resolveLinkHref', () => {
  const relationshipCases: Array<{
    expectedHref: string
    link: CMSLinkType
    relationTo: string
  }> = [
    {
      relationTo: 'pages',
      link: {
        type: 'reference',
        reference: { relationTo: 'pages', value: documentWithSlug<Page>('about') },
      },
      expectedHref: '/about',
    },
    {
      relationTo: 'posts',
      link: {
        type: 'reference',
        reference: { relationTo: 'posts', value: documentWithSlug<Post>('example-post') },
      },
      expectedHref: '/posts/example-post',
    },
    {
      relationTo: 'case-studies',
      link: {
        type: 'reference',
        reference: {
          relationTo: 'case-studies',
          value: documentWithSlug<CaseStudy>('example-case'),
        },
      },
      expectedHref: '/case-studies/example-case',
    },
    {
      relationTo: 'categories',
      link: {
        type: 'reference',
        reference: {
          relationTo: 'categories',
          value: documentWithSlug<Category>('example-category'),
        },
      },
      expectedHref: '/posts?category=example-category',
    },
  ]

  it.each(relationshipCases)(
    'resolves a populated $relationTo reference',
    ({ expectedHref, link }) => {
      expect(resolveLinkHref(link)).toBe(expectedHref)
    },
  )

  it('resolves a custom URL', () => {
    expect(resolveLinkHref({ type: 'custom', url: 'https://example.com/contact' })).toBe(
      'https://example.com/contact',
    )
  })

  it('returns null for an unpopulated relationship ID or missing slug', () => {
    expect(
      resolveLinkHref({
        type: 'reference',
        reference: { relationTo: 'pages', value: 'page-id' },
      }),
    ).toBeNull()
    expect(
      resolveLinkHref({
        type: 'reference',
        reference: { relationTo: 'posts', value: {} as Post },
      }),
    ).toBeNull()
  })

  it('returns null when a malformed relationship has a null value', () => {
    expect(
      resolveLinkHref({
        type: 'reference',
        reference: { relationTo: 'pages', value: null },
      } as unknown as CMSLinkType),
    ).toBeNull()
  })
})

describe('CMSLink', () => {
  it('renders the resolved href and secure new-tab attributes', () => {
    const { getByRole } = render(
      <CMSLink
        label="Example post"
        newTab
        reference={{
          relationTo: 'posts',
          value: documentWithSlug<Post>('example-post'),
        }}
        type="reference"
      />,
    )

    const link = getByRole('link', { name: 'Example post' })
    expect(link.getAttribute('href')).toBe('/posts/example-post')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('renders nothing for unresolved references', () => {
    const { container } = render(
      <CMSLink
        label="Missing page"
        reference={{ relationTo: 'pages', value: 42 }}
        type="reference"
      />,
    )

    expect(container.firstChild).toBeNull()
  })
})
