import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Component } from '@/collections/Products/blocks/Code/Component'
import { buildProductCodeDocument } from '@/collections/Products/blocks/Code/document'
import type { Media, ProductCodeBlock } from '@/payload-types'

const block: ProductCodeBlock = {
  blockType: 'productCode',
  label: 'Interactive view',
  html: '<main>Content</main>',
  css: 'main{color:var(--color-foreground)}',
  js: 'window.ready=true',
  minHeight: 400,
  width: 'standard',
}
afterEach(cleanup)

describe('Product Code isolation', () => {
  it('injects metadata, theme tokens, CSS, HTML, JS and height observer in order', () => {
    const source = buildProductCodeDocument(block)
    const parts = [
      '<meta charset=',
      'name="viewport"',
      ':root{',
      'body{margin:0',
      'main{color:',
      '<main>Content',
      'window.ready=true',
      'ResizeObserver',
    ]
    for (let index = 1; index < parts.length; index++)
      expect(source.indexOf(parts[index])).toBeGreaterThan(source.indexOf(parts[index - 1]))
    expect(source).toContain('--color-foreground:')
    expect(source).toContain('<html data-website-theme="default">')
  })

  it('injects the canonical typography roles before custom CSS', () => {
    const source = buildProductCodeDocument(block)
    expect(source).toContain('.website-type-heading-2')
    expect(source).toContain('.website-type-body-md')
    expect(source.indexOf('.website-type-body-md')).toBeLessThan(source.indexOf('main{color:'))
  })

  it('shows an optional h3 title while retaining the Admin label as the iframe title', () => {
    const { container } = render(<Component {...block} title="How it works" />)
    expect(screen.getByRole('heading', { level: 3, name: 'How it works' })).toBeTruthy()
    expect(screen.getByTitle(block.label).getAttribute('sandbox')).toBe('allow-scripts')
    expect(container.querySelectorAll('[data-product-block="productCode"]')).toHaveLength(1)
    expect(container.textContent).not.toContain(block.label)
  })

  it('omits a visible header when title is empty without losing the iframe label', () => {
    render(<Component {...block} />)
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByTitle(block.label)).toBeTruthy()
  })

  it.each([NaN, Infinity, -Infinity])(
    'uses the 240px placeholder when minHeight is nonfinite (%s)',
    (minHeight) => {
      const server = renderToStaticMarkup(<Component {...block} minHeight={minHeight} />)
      expect(server).toContain('min-height:240px')

      render(<Component {...block} minHeight={minHeight} />)
      const frame = screen.getByTitle(block.label) as HTMLIFrameElement
      expect(frame.parentElement?.style.minHeight).toBe('240px')
      expect(frame.style.height).toBe('240px')

      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: frame.contentWindow,
            data: { type: 'productCode-height', height: 180 },
          }),
        )
      })
      expect(frame.style.height).toBe('240px')
    },
  )

  it('escapes closing script/style sequences without changing asset indexing', () => {
    const source = buildProductCodeDocument({
      ...block,
      html: '<img src="{{asset:0}}">{{asset:1}} {{asset:99}}',
      css: 'a{content:"</StYle><script>bad()</script>"}',
      js: 'const value="</ScRiPt><script>bad()</script>"',
      assets: [{ id: 'a', url: '/asset.jpg', updatedAt: '2026-10-27' } as Media, 'unpopulated'],
    })
    expect(source).toContain('/asset.jpg?2026-10-27')
    expect(source).toContain('{{asset:1}} {{asset:99}}')
    expect(source).not.toContain('</StYle>')
    expect(source).not.toContain('</ScRiPt>')
    expect(source).toContain('\\u003c/ScRiPt>')
    expect(source).toContain('<\\/style>')
  })

  it('uses only allow-scripts and validates message source, type and finite height before clamping', () => {
    const { container } = render(<Component {...block} />)
    const frame = screen.getByTitle(block.label) as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.style.height).toBe('400px')
    expect(container.querySelector('[data-ready="false"]')).toBeTruthy()
    const send = (
      height: unknown,
      source: MessageEventSource | null = frame.contentWindow,
      type = 'productCode-height',
    ) =>
      act(() => {
        window.dispatchEvent(new MessageEvent('message', { source, data: { type, height } }))
      })
    send(800, window)
    send(800, frame.contentWindow, 'untrusted')
    send(Infinity)
    send(NaN)
    send('800')
    fireEvent.load(frame)
    expect(frame.style.height).toBe('400px')
    expect(container.querySelector('[data-ready="true"]')).toBeNull()
    send(800)
    expect(frame.style.height).toBe('800px')
    expect(container.querySelector('[data-ready="true"]')).toBeTruthy()
    send(-100)
    expect(frame.style.height).toBe('400px')
    send(20000)
    expect(frame.style.height).toBe('10000px')
  })

  it('resets readiness for a new source and rejects messages from the previous iframe', () => {
    const { container, rerender } = render(<Component {...block} />)
    const original = screen.getByTitle(block.label) as HTMLIFrameElement
    const originalWindow = original.contentWindow
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: originalWindow,
          data: { type: 'productCode-height', height: 700 },
        }),
      )
    })
    expect(container.querySelector('[data-ready="true"]')).toBeTruthy()

    rerender(<Component {...block} html="<main>Updated</main>" />)
    const updated = screen.getByTitle(block.label) as HTMLIFrameElement
    expect(updated).not.toBe(original)
    expect(updated.style.height).toBe('400px')
    expect(container.querySelector('[data-ready="true"]')).toBeNull()
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: originalWindow,
          data: { type: 'productCode-height', height: 900 },
        }),
      )
    })
    expect(container.querySelector('[data-ready="true"]')).toBeNull()

    // Returning to an earlier document still starts a fresh iframe measurement.
    rerender(<Component {...block} />)
    expect(container.querySelector('[data-ready="true"]')).toBeNull()
  })

  it.each(['default', 'inverse'])(
    'inherits the surrounding %s theme after hydration while retaining canonical server tokens',
    (theme) => {
      render(
        <section data-website-theme={theme}>
          <Component {...block} />
        </section>,
      )
      const frame = screen.getByTitle(block.label) as HTMLIFrameElement
      expect(frame.srcdoc).toContain(`<html data-website-theme="${theme}">`)
      expect(frame.srcdoc).toContain('--website-color-disabled-foreground:')
    },
  )

  it('reprepares unchanged code only when its nearest Section theme changes', async () => {
    const stylesheet = document.createElement('style')
    stylesheet.textContent = `
      section[data-website-theme='default'] [data-ready] { --website-color-foreground: #262629; }
      section[data-website-theme='inverse'] [data-ready] { --website-color-foreground: #ffffff; }
    `
    document.head.append(stylesheet)
    const writes: string[] = []
    const original = Element.prototype.setAttribute
    const attribute = vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
      this: Element,
      name: string,
      value: string,
    ) {
      if (this.tagName === 'IFRAME' && name.toLowerCase() === 'srcdoc') writes.push(value)
      return original.call(this, name, value)
    })
    try {
      const { container, rerender } = render(
        <div data-website-theme="default">
          <section data-website-theme="default">
            <Component {...block} />
          </section>
        </div>,
      )
      let frame = screen.getByTitle(block.label) as HTMLIFrameElement
      const preparedDocument = () =>
        new DOMParser().parseFromString(
          (screen.getByTitle(block.label) as HTMLIFrameElement).srcdoc,
          'text/html',
        )
      const measure = () =>
        act(() => {
          window.dispatchEvent(
            new MessageEvent('message', {
              source: frame.contentWindow,
              data: { type: 'productCode-height', height: 700 },
            }),
          )
        })
      expect(writes).toHaveLength(1)
      expect(preparedDocument().querySelector('#product-code-theme')?.textContent).toContain(
        '--website-color-foreground:#262629;',
      )
      measure()

      rerender(
        <div data-website-theme="inverse">
          <section data-website-theme="default">
            <Component {...block} />
          </section>
        </div>,
      )
      await act(async () => {})
      expect(writes).toHaveLength(1)
      expect(container.querySelector('[data-ready="true"]')).toBeTruthy()

      const previousFrame = frame
      const previousWindow = frame.contentWindow
      rerender(
        <div data-website-theme="inverse">
          <section data-website-theme="inverse">
            <Component {...block} />
          </section>
        </div>,
      )
      await waitFor(() =>
        expect(preparedDocument().documentElement.dataset.websiteTheme).toBe('inverse'),
      )
      expect(preparedDocument().querySelector('#product-code-theme')?.textContent).toContain(
        '--website-color-foreground:#ffffff;',
      )
      frame = screen.getByTitle(block.label) as HTMLIFrameElement
      expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
      expect(writes).toHaveLength(2)
      expect(container.querySelector('[data-ready="true"]')).toBeNull()
      expect(frame.style.height).toBe('400px')
      act(() => {
        window.dispatchEvent(
          new MessageEvent('message', {
            source: previousWindow,
            data: { type: 'productCode-height', height: 900 },
          }),
        )
      })
      expect(container.querySelector('[data-ready="true"]')).toBeNull()
      expect(frame).not.toBe(previousFrame)
      expect(frame.contentWindow === previousWindow).toBe(false)
      measure()
      expect(container.querySelector('[data-ready="true"]')).toBeTruthy()

      // An identical attribute write must not restart the current iframe.
      await act(async () => {
        container.querySelector('section')!.setAttribute('data-website-theme', 'inverse')
      })
      expect(writes).toHaveLength(2)
      expect(container.querySelector('[data-ready="true"]')).toBeTruthy()
      expect(frame.style.height).toBe('700px')
    } finally {
      attribute.mockRestore()
      stylesheet.remove()
    }
  })

  it('encodes asset URL delimiters for HTML, CSS and script string substitution', () => {
    const source = buildProductCodeDocument({
      ...block,
      html: '<img src="{{asset:0}}">',
      css: 'main{background:url("{{asset:0}}")}',
      js: "const image='{{asset:0}}'",
      assets: [{ id: 'asset', url: '/image\'"<test>.jpg' } as Media],
    })
    expect(source.match(/\/image%27%22%3Ctest%3E.jpg/g)).toHaveLength(3)
  })

  it('preserves script parsing and executes raw JS comparisons and HTML-like strings', async () => {
    const source = buildProductCodeDocument({
      ...block,
      js: `const sample = '<!--<script>'; const closing = '</ScRiPt>'; document.body.dataset.sample = sample + closing; document.body.dataset.comparison = String(1 < 2)`,
    })
    const parsed = new DOMParser().parseFromString(source, 'text/html')
    expect(parsed.querySelectorAll('script')).toHaveLength(2)
    expect(parsed.querySelectorAll('script')[1].textContent).toContain('ResizeObserver')
    const frame = document.createElement('iframe')
    document.body.append(frame)
    Object.defineProperty(frame.contentWindow, 'ResizeObserver', {
      value: class {
        observe() {}
      },
    })
    const measured = vi
      .spyOn(frame.contentWindow!.parent, 'postMessage')
      .mockImplementation(() => undefined)
    frame.contentDocument!.open()
    frame.contentDocument!.write(source)
    frame.contentDocument!.close()
    expect(frame.contentDocument!.body.dataset.sample).toBe('<!--<script></ScRiPt>')
    expect(frame.contentDocument!.body.dataset.comparison).toBe('true')
    await waitFor(() =>
      expect(measured).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'productCode-height' }),
        '*',
      ),
    )
    frame.remove()
    measured.mockRestore()
  })

  it('reports height again when document fonts finish settling', async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    Object.defineProperty(frame.contentWindow, 'ResizeObserver', {
      value: class {
        observe() {}
      },
    })
    let settleFonts!: () => void
    Object.defineProperty(frame.contentDocument, 'fonts', {
      value: {
        ready: new Promise<void>((resolve) => {
          settleFonts = resolve
        }),
      },
    })
    const measured = vi
      .spyOn(frame.contentWindow!.parent, 'postMessage')
      .mockImplementation(() => undefined)
    try {
      frame.contentDocument!.open()
      frame.contentDocument!.write(buildProductCodeDocument(block))
      frame.contentDocument!.close()
      await waitFor(() => expect(frame.contentDocument!.readyState).toBe('complete'))
      measured.mockClear()
      settleFonts()
      await waitFor(() =>
        expect(measured).toHaveBeenCalledWith(
          expect.objectContaining({ type: 'productCode-height' }),
          '*',
        ),
      )
    } finally {
      frame.remove()
      measured.mockRestore()
    }
  })
})

it('reserves the SSR height without starting an iframe before token preparation', () => {
  const server = renderToStaticMarkup(<Component {...block} />)
  expect(server).not.toContain('<iframe')
  expect(server).toContain('min-height:400px')
})

it('assigns one prepared srcdoc when the iframe first mounts', () => {
  const writes: string[] = []
  const original = Element.prototype.setAttribute
  const attribute = vi.spyOn(Element.prototype, 'setAttribute').mockImplementation(function (
    this: Element,
    name: string,
    value: string,
  ) {
    if (this.tagName === 'IFRAME' && name.toLowerCase() === 'srcdoc') writes.push(value)
    return original.call(this, name, value)
  })
  try {
    const { rerender } = render(
      <div data-website-theme="inverse">
        <Component {...block} />
      </div>,
    )
    const frame = screen.getByTitle(block.label)
    expect(writes).toHaveLength(1)
    expect(writes[0]).toContain('<html data-website-theme="inverse">')
    expect(writes[0]).toContain(
      new URL('/fonts/product-code/InterVariable.woff2', window.location.origin).href,
    )
    expect(writes[0]).toContain(
      new URL('/fonts/product-code/GeistMono-Variable.woff2', window.location.origin).href,
    )
    expect(writes[0]).toContain('font-family:ProductCodeInter;')
    expect(writes[0]).toContain('font-family:ProductCodeGeistMono;')
    expect(writes[0]).toContain('--website-font-sans:ProductCodeInter,system-ui,sans-serif')
    expect(writes[0]).toContain('--website-font-mono:ProductCodeGeistMono,ui-monospace,monospace')
    act(() => {
      window.dispatchEvent(
        new MessageEvent('message', {
          source: (frame as HTMLIFrameElement).contentWindow,
          data: { type: 'productCode-height', height: 700 },
        }),
      )
    })
    rerender(
      <div data-website-theme="inverse">
        <Component {...block} minHeight={500} />
      </div>,
    )
    expect(screen.getByTitle(block.label)).toBe(frame)
    expect(frame.parentElement?.dataset.ready).toBe('true')
    expect(frame.style.height).toBe('700px')
    expect(writes).toHaveLength(1)
  } finally {
    attribute.mockRestore()
  }
})
