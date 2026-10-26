import React from 'react'
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
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
    const source = buildProductCodeDocument({ ...block, theme: 'inverse' })
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
    expect(source).toContain('data-website-theme="inverse"')
    expect(buildProductCodeDocument({ ...block, theme: 'default' })).not.toBe(source)
  })

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
    render(<Component {...block} />)
    const frame = screen.getByTitle(block.label) as HTMLIFrameElement
    expect(frame.getAttribute('sandbox')).toBe('allow-scripts')
    expect(frame.style.height).toBe('400px')
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
    send('800')
    expect(frame.style.height).toBe('400px')
    send(800)
    expect(frame.style.height).toBe('800px')
    send(-100)
    expect(frame.style.height).toBe('400px')
    send(20000)
    expect(frame.style.height).toBe('10000px')
  })

  it('inherits the surrounding theme after hydration while retaining canonical server tokens', () => {
    render(
      <div data-website-theme="inverse">
        <Component {...block} />
      </div>,
    )
    const frame = screen.getByTitle(block.label) as HTMLIFrameElement
    expect(frame.srcdoc).toContain('<html data-website-theme="inverse">')
    expect(frame.srcdoc).toContain('--website-color-disabled-foreground:')
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
})
