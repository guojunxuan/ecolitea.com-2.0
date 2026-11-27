import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Blog } from '@/payload-types'

vi.mock('@/components/Media', () => ({ Media: () => null }))
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => <svg /> }))

import RichText from '@/components/RichText'
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
const lexicalDocument = (...children: object[]) =>
  ({
    root: { type: 'root', version: 1, direction: null, format: '', indent: 0, children },
  }) as Blog['content']

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})

describe('blog table of contents', () => {
  const content = lexicalDocument(
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
    {
      type: 'block',
      version: 2,
      fields: {
        id: 'banner',
        blockType: 'blogBanner',
        style: 'info',
        content: lexicalDocument(heading('h2', [text('Block heading')])),
      },
    },
    heading('h2', [text('!!!')]),
    heading('h2', [text('Foo')]),
    heading('h3', [text('Hello, '), text('世界！')]),
    heading('h2', [text('ＡＢＣ & Tea')]),
  )

  it('extracts top-level H2 and H3 text with stable article-wide IDs', () => {
    expect(extractTOC(content)).toEqual([
      { id: 'foo', text: 'Foo', level: 2 },
      { id: 'deep-tea', text: 'Deep Tea', level: 3 },
      { id: 'foo-2', text: 'Foo', level: 2 },
      { id: 'hello-世界', text: 'Hello, 世界！', level: 3 },
      { id: 'abc-tea', text: 'ＡＢＣ & Tea', level: 2 },
    ])
  })

  it('renders TOC links that resolve to exactly the article heading IDs', () => {
    const items = extractTOC(content)
    const { container } = render(
      <>
        <TableOfContents items={items} />
        <RichText data={content} context="article" headingIds={items.map((item) => item.id)} />
      </>,
    )
    const anchoredHeadings = Array.from(
      container.querySelectorAll('.payload-richtext h2[id], .payload-richtext h3[id]'),
      (node) => ({
        id: node.id,
        text: node.textContent?.trim(),
      }),
    )
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

  it('opens the mobile dropdown under the bar and closes it with Escape', () => {
    render(<TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />)
    const trigger = screen.getByRole('button', { name: 'Table of contents' })
    expect(trigger.querySelector('svg[aria-hidden="true"]')).not.toBeNull()
    expect(trigger.textContent).toContain('On this page')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!
    expect(panel.tagName).toBe('NAV')
    expect(panel.hidden).toBe(true)
    expect(screen.queryByRole('dialog')).toBeNull()

    trigger.focus()
    fireEvent.click(trigger)
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(panel.hidden).toBe(false)
    expect(document.body.style.overflow).toBe('')

    fireEvent.keyDown(panel, { key: 'Escape' })
    expect(panel.hidden).toBe(true)
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(trigger).toBe(document.activeElement)
  })

  it('closes on link selection, outside pointer, or a second trigger click', () => {
    const { container } = render(
      <>
        <TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />
        <p>Article text</p>
      </>,
    )
    const trigger = screen.getByRole('button', { name: 'Table of contents' })
    const panel = document.getElementById(trigger.getAttribute('aria-controls')!)!

    fireEvent.click(trigger)
    fireEvent.click(panel.querySelector('a[href="#foo"]')!)
    expect(panel.hidden).toBe(true)

    fireEvent.click(trigger)
    fireEvent.pointerDown(panel)
    expect(panel.hidden).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Close table of contents' }))
    expect(panel.hidden).toBe(true)

    fireEvent.click(trigger)
    fireEvent.pointerDown(screen.getByText('Article text'))
    expect(panel.hidden).toBe(true)

    fireEvent.click(trigger)
    fireEvent.click(trigger)
    expect(panel.hidden).toBe(true)
    expect(container.querySelector('#table-of-contents')).not.toBeNull()
  })

  it('leaves page-context headings unchanged and hides an empty TOC', () => {
    const { container } = render(
      <>
        <TableOfContents items={[]} />
        <RichText data={content} />
      </>,
    )
    expect(screen.queryByRole('navigation', { name: 'Table of contents' })).toBeNull()
    expect(container.querySelectorAll('h2[id], h3[id]')).toHaveLength(0)
  })
})

describe('active article section', () => {
  it('keeps the active link visible inside a long desktop contents list', () => {
    let callback: IntersectionObserverCallback = () => {}
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback) {
          callback = cb
        }
        observe = vi.fn()
        disconnect = vi.fn()
      },
    )
    const { container } = render(
      <>
        <h2 id="first">First</h2>
        <h2 id="last">Last</h2>
        <TableOfContents
          items={[
            { id: 'first', text: 'First', level: 2 },
            { id: 'last', text: 'Last', level: 2 },
          ]}
        />
      </>,
    )
    const list = container.querySelectorAll('nav[aria-label="Table of contents"]')[1]
      .children[1] as HTMLDivElement
    const lastLink = list.querySelector('a[href="#last"]')!
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 100, bottom: 300 } as DOMRect)
    vi.spyOn(lastLink, 'getBoundingClientRect').mockReturnValue({
      top: 500,
      bottom: 540,
    } as DOMRect)
    const lastHeadingRect = vi.spyOn(
      container.querySelector('#last')!,
      'getBoundingClientRect',
    )
    lastHeadingRect.mockReturnValue({ top: 500 } as DOMRect)
    act(() => callback([], {} as IntersectionObserver))
    lastHeadingRect.mockReturnValue({ top: 100 } as DOMRect)
    list.scrollTop = 0
    act(() => callback([], {} as IntersectionObserver))
    expect(lastLink.getAttribute('aria-current')).toBe('location')
    expect(list.scrollTop).toBe(252)
  })

  it('shares the observed active heading between desktop links and the mobile bar', () => {
    let callback: IntersectionObserverCallback = () => {}
    const disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: IntersectionObserverCallback, options: IntersectionObserverInit) {
          callback = cb
          expect(options.rootMargin).toBe(`0px 0px -${Math.round(window.innerHeight * 0.7)}px 0px`)
        }
        observe = vi.fn()
        disconnect = disconnect
      },
    )
    const items = [
      { id: 'first', text: 'First section', level: 2 as const },
      { id: 'next', text: 'Next section', level: 3 as const },
    ]
    const { container, unmount } = render(
      <>
        <h2 id="first">First section</h2>
        <h3 id="next">Next section</h3>
        <TableOfContents items={items} />
      </>,
    )
    act(() =>
      callback(
        [
          {
            target: container.querySelector('#next'),
            isIntersecting: true,
            boundingClientRect: { top: 100 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    )
    expect(screen.getByRole('button', { name: 'Table of contents' }).textContent).toContain(
      'Next section',
    )
    expect(container.querySelector('nav a[href="#next"]')?.getAttribute('aria-current')).toBe(
      'location',
    )
    expect(container.querySelector('nav a[href="#first"]')?.hasAttribute('aria-current')).toBe(
      false,
    )
    // The later heading becomes current as it enters the upper 30%, even while the first remains there.
    act(() =>
      callback(
        [
          {
            target: container.querySelector('#first'),
            isIntersecting: true,
            boundingClientRect: { top: 20 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    )
    expect(container.querySelector('nav a[href="#next"]')?.getAttribute('aria-current')).toBe(
      'location',
    )
    // In a long section the earlier heading is above the viewport, so no headings intersect on the way back.
    vi.spyOn(container.querySelector('#first')!, 'getBoundingClientRect').mockReturnValue({
      top: -1000,
    } as DOMRect)
    vi.spyOn(container.querySelector('#next')!, 'getBoundingClientRect').mockReturnValue({
      top: 500,
    } as DOMRect)
    act(() =>
      callback(
        [
          {
            target: container.querySelector('#first'),
            isIntersecting: false,
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    )
    // Scrolling back moves the later heading out of the observed region and restores the earlier one.
    act(() =>
      callback(
        [
          {
            target: container.querySelector('#next'),
            isIntersecting: false,
            boundingClientRect: { top: 500 },
          } as IntersectionObserverEntry,
        ],
        {} as IntersectionObserver,
      ),
    )
    expect(screen.getByRole('button', { name: 'Table of contents' }).textContent).toContain(
      'First section',
    )
    expect(container.querySelector('nav a[href="#first"]')?.getAttribute('aria-current')).toBe(
      'location',
    )

    unmount()
    expect(disconnect).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('responsive TOC focus target', () => {
  it.each([true, false])('keeps a single visible skip target for desktop=%s', (desktop) => {
    vi.stubGlobal('matchMedia', () => ({
      matches: desktop,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    const { container } = render(<TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />)
    const targets = container.querySelectorAll('#table-of-contents')
    expect(targets).toHaveLength(1)
    expect(targets[0].tagName).toBe('ASIDE')
    expect(targets[0].getAttribute('tabindex')).toBe('-1')
    if (!desktop)
      expect(targets[0].querySelector('button[aria-label="Table of contents"]')).toBeTruthy()
    ;(targets[0] as HTMLElement).focus()
    expect(document.activeElement).toBe(targets[0])
    vi.unstubAllGlobals()
  })
})

describe('TOC viewport observation region', () => {
  it.each([1440, 390])(
    'uses viewport height at width %s and rebuilds/cleans up on height resize',
    (width) => {
      const originalHeight = window.innerHeight
      const originalWidth = window.innerWidth
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 })
      const instances: {
        margin: string | undefined
        observe: ReturnType<typeof vi.fn>
        disconnect: ReturnType<typeof vi.fn>
      }[] = []
      vi.stubGlobal(
        'IntersectionObserver',
        class {
          observe = vi.fn()
          disconnect = vi.fn()
          constructor(_callback: IntersectionObserverCallback, options: IntersectionObserverInit) {
            instances.push({
              margin: options.rootMargin,
              observe: this.observe,
              disconnect: this.disconnect,
            })
          }
        },
      )
      const removeListener = vi.spyOn(window, 'removeEventListener')
      const { container, unmount } = render(
        <>
          <h2 id="foo">Foo</h2>
          <TableOfContents items={[{ id: 'foo', text: 'Foo', level: 2 }]} />
        </>,
      )
      expect(instances).toHaveLength(1)
      expect(instances[0].margin).toBe('0px 0px -700px 0px')
      expect(instances[0].observe).toHaveBeenCalledWith(container.querySelector('#foo'))
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
      act(() => window.dispatchEvent(new Event('resize')))
      expect(instances).toHaveLength(2)
      expect(instances[0].disconnect).toHaveBeenCalledOnce()
      expect(instances[1].margin).toBe('0px 0px -560px 0px')
      expect(instances[1].observe).toHaveBeenCalledWith(container.querySelector('#foo'))
      unmount()
      expect(instances[1].disconnect).toHaveBeenCalledOnce()
      expect(removeListener).toHaveBeenCalledWith('resize', expect.any(Function))
      act(() => window.dispatchEvent(new Event('resize')))
      expect(instances).toHaveLength(2)
      removeListener.mockRestore()
      Object.defineProperty(window, 'innerHeight', { configurable: true, value: originalHeight })
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
      vi.unstubAllGlobals()
    },
  )
})
