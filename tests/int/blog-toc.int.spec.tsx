import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Blog } from '@/payload-types'

vi.mock('@/components/Media', () => ({ Media: () => null }))
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => <svg /> }))

import { RenderBlocks } from '@/blocks/RenderBlocks'
import { TableOfContents } from '@/components/TableOfContents'
import { extractTOC } from '@/utilities/blogs/extractTOC'

const text = (value: string) => ({
  type: 'text',
  version: 1,
  text: value,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
})
const heading = (tag: string, children: object[]) => ({
  type: 'heading',
  version: 1,
  tag,
  children,
})
const prose = (...children: object[]) =>
  ({
    blockType: 'prose',
    content: {
      root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children },
    },
  }) as Blog['content'][number]

afterEach(cleanup)

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true
    },
  })
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false
      this.dispatchEvent(new Event('close'))
    },
  })
})

describe('blog table of contents', () => {
  const blocks = [
    prose(
      heading('h2', [text('Foo')]),
      heading('h3', [
        {
          type: 'link',
          version: 3,
          fields: { linkType: 'custom', url: '#x' },
          children: [text('Deep '), text('Tea')],
        },
      ]),
      heading('h4', [text('Excluded')]),
      { type: 'quote', version: 1, children: [heading('h2', [text('Nested')])] },
      heading('h2', [text('   ')]),
    ),
    prose(
      heading('h2', [text('!!!')]),
      heading('h2', [text('Foo')]),
      heading('h3', [text('Hello, '), text('世界！')]),
      heading('h2', [text('ＡＢＣ & Tea')]),
    ),
  ] as Blog['content']

  it('extracts top-level H2 and H3 text with stable article-wide IDs', () => {
    expect(extractTOC(blocks)).toEqual([
      { id: 'foo', text: 'Foo', level: 2 },
      { id: 'deep-tea', text: 'Deep Tea', level: 3 },
      { id: 'foo-2', text: 'Foo', level: 2 },
      { id: 'hello-世界', text: 'Hello, 世界！', level: 3 },
      { id: 'abc-tea', text: 'ＡＢＣ & Tea', level: 2 },
    ])
  })

  it('renders TOC links that resolve to exactly the article heading IDs', () => {
    const items = extractTOC(blocks)
    const { container } = render(
      <>
        <TableOfContents items={items} />
        <RenderBlocks blocks={blocks} context="article" />
      </>,
    )
    const anchoredHeadings = Array.from(container.querySelectorAll('.payload-richtext h2[id], .payload-richtext h3[id]'), (node) => ({
      id: node.id,
      text: node.textContent?.trim(),
    }))
    expect(anchoredHeadings).toEqual(items.map(({ id, text }) => ({ id, text })))
    const navs = screen.getAllByRole('navigation', { name: 'Table of contents' })
    expect(navs).toHaveLength(1)
    for (const nav of navs) {
      expect(Array.from(nav.querySelectorAll('a'), (link) => link.getAttribute('href'))).toEqual(
        items.map((item) => `#${item.id}`),
      )
    }
    expect(screen.getByRole('heading', { name: 'Excluded', level: 4 }).id).toBe('')
    expect(screen.getByRole('heading', { name: 'Nested', level: 2 }).id).toBe('')
    expect(screen.getByRole('heading', { name: '!!!', level: 2 }).id).toBe('')
  })

  it('opens a named mobile drawer, closes with Escape, and restores focus and scroll', () => {
    render(<TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />)
    const trigger = screen.getByRole('button', { name: 'Open table of contents' })
    expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(trigger.textContent).not.toContain('☰')
    trigger.focus()
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Table of contents' })
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    const closeButton = screen.getByRole('button', { name: 'Close table of contents' })
    expect(closeButton.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(closeButton.textContent).not.toContain('×')
    expect(closeButton).toBe(document.activeElement)
    fireEvent(dialog, new Event('cancel', { cancelable: true }))
    expect(dialog.hasAttribute('open')).toBe(false)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.body.style.overflow).toBe('')
    expect(trigger).toBe(document.activeElement)
  })

  it('closes on backdrop or link selection and restores an existing overflow style', () => {
    document.body.style.overflow = 'auto'
    const { container } = render(<TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />)
    const trigger = screen.getByRole('button', { name: 'Open table of contents' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', { name: 'Table of contents' })
    fireEvent.click(dialog)
    expect(dialog.hasAttribute('open')).toBe(false)
    expect(document.body.style.overflow).toBe('auto')
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('dialog').querySelector('a[href="#foo"]')!)
    expect(dialog.hasAttribute('open')).toBe(false)
    expect(container.querySelector('#table-of-contents')).not.toBeNull()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })

  it('closes from its close button and unlocks scroll when unmounted while open', () => {
    const { unmount } = render(<TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />)
    const trigger = screen.getByRole('button', { name: 'Open table of contents' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Close table of contents' }))
    expect(trigger).toBe(document.activeElement)
    expect(document.body.style.overflow).toBe('')
    fireEvent.click(trigger)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })

  it('leaves page-context headings unchanged and hides an empty TOC', () => {
    const { container } = render(
      <>
        <TableOfContents items={[]} />
        <RenderBlocks blocks={blocks} />
      </>,
    )
    expect(screen.queryByRole('navigation', { name: 'Table of contents' })).toBeNull()
    expect(container.querySelectorAll('h2[id], h3[id]')).toHaveLength(0)
  })
})
