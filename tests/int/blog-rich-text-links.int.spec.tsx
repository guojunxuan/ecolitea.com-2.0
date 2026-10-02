import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/Media', () => ({ Media: () => <div /> }))
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => <svg /> }))

import RichText from '@/components/RichText'

afterEach(cleanup)

const richTextWithLink = (relationTo: string, slug: string) => ({
  root: {
    type: 'root', version: 1, direction: null, format: '', indent: 0,
    children: [{
      type: 'paragraph', version: 1, direction: null, format: '', indent: 0,
      children: [{
        type: 'link', version: 3, direction: null, format: '', indent: 0,
        fields: { linkType: 'internal', doc: { relationTo, value: { slug } } },
        children: [{ type: 'text', version: 1, text: 'Read more', format: 0, detail: 0, mode: 'normal', style: '' }],
      }],
    }],
  },
}) as never

describe('RichText internal content links', () => {
  it.each([
    ['blogs', 'tea-notes', '/blogs/tea-notes'],
    ['blog-categories', 'brewing', '/blogs/category/brewing'],
    ['posts', 'news', '/posts/news'],
  ])('links %s to its public route', (relationTo, slug, expected) => {
    render(<RichText data={richTextWithLink(relationTo, slug)} />)
    expect(screen.getByRole('link', { name: 'Read more' }).getAttribute('href')).toBe(expected)
  })
})
