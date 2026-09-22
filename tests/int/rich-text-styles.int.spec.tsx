import { cleanup, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import postcss, { type AtRule } from 'postcss'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@payloadcms/richtext-lexical/react', () => ({
  JSXConvertersFunction: {},
  LinkJSXConverter: () => ({}),
  RichText: ({
    className,
    converters,
  }: {
    className?: string
    converters: (args: { defaultConverters: Record<string, never> }) => {
      blocks: Record<string, (args: { node: { fields: Record<string, never> } }) => React.ReactNode>
    }
  }) => {
    const { blocks } = converters({ defaultConverters: {} })
    const node = { fields: {} }

    return (
      <div className={className} data-testid="rich-text">
        {blocks.banner({ node })}
        {blocks.mediaBlock({ node })}
        {blocks.code({ node })}
        {blocks.cta({ node })}
      </div>
    )
  },
}))

vi.mock('@/blocks/Banner/Component', () => ({
  BannerBlock: ({ className }: { className?: string }) => (
    <div className={className} data-testid="embedded-banner">
      <div className="payload-richtext payload-richtext--plain" data-testid="banner-rich-text">
        <p>Banner copy stays plain.</p>
      </div>
    </div>
  ),
}))

vi.mock('@/blocks/MediaBlock/Component', () => ({
  MediaBlock: ({
    captionClassName,
    className,
    imgClassName,
  }: {
    captionClassName?: string
    className?: string
    imgClassName?: string
  }) => (
    <div
      className={className}
      data-caption-class={captionClassName}
      data-image-class={imgClassName}
      data-testid="embedded-media"
    >
      <div
        className="payload-richtext payload-richtext--content"
        data-testid="media-caption-rich-text"
      >
        <h2>Caption heading</h2>
        <p>
          Caption with <a href="https://example.com/caption">a link</a>.
        </p>
      </div>
    </div>
  ),
}))

vi.mock('@/blocks/Code/Component', () => ({
  CodeBlock: ({ className }: { className?: string }) => (
    <div className={className} data-testid="embedded-code" />
  ),
}))

vi.mock('@/blocks/CallToAction/Component', () => ({
  CallToActionBlock: () => (
    <div data-testid="embedded-cta">
      <div className="payload-richtext payload-richtext--content" data-testid="cta-rich-text">
        <h2>CTA heading</h2>
        <p>
          CTA body with <strong>emphasis</strong>.
        </p>
        <ul>
          <li>CTA list item</li>
        </ul>
      </div>
    </div>
  ),
}))

vi.mock('@/heros/HeaderThemeSync', () => ({
  HeaderThemeSync: () => null,
}))

import RichText from '@/components/RichText'
import styles from '@/components/RichText/index.module.css'
import { HighImpactHero } from '@/heros/HighImpact'

afterEach(cleanup)

const data = { root: { children: [], type: 'root', version: 1 } } as never
const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/RichText/index.tsx'),
  'utf8',
)
const richTextStyles = fs.readFileSync(
  path.join(process.cwd(), 'src/components/RichText/index.module.css'),
  'utf8',
)
const contentStyles = fs.readFileSync(path.join(process.cwd(), 'src/styles/content.css'), 'utf8')

describe('RichText style modes', () => {
  it.each([
    { enableGutter: true, enableProse: true },
    { enableGutter: true, enableProse: false },
    { enableGutter: false, enableProse: true },
    { enableGutter: false, enableProse: false },
  ])(
    'keeps explicit content and gutter semantics for $enableGutter/$enableProse',
    ({ enableGutter, enableProse }) => {
      render(
        <RichText
          className="consumer-class"
          data={data}
          enableGutter={enableGutter}
          enableProse={enableProse}
        />,
      )

      const root = screen.getByTestId('rich-text')

      expect(root.classList).toContain('payload-richtext')
      expect(root.classList).toContain(styles.root)
      expect(root.classList).toContain('consumer-class')
      expect(root.classList.contains(styles.withGutter)).toBe(enableGutter)
      expect(root.classList.contains(styles.content)).toBe(enableProse)
      expect(root.classList.contains('payload-richtext--content')).toBe(enableProse)
      expect(root.classList.contains('payload-richtext--plain')).toBe(!enableProse)
      expect(root.classList.contains(styles.plain)).toBe(!enableProse)
      expect(root.classList.contains('container')).toBe(false)
      expect(root.classList.contains('prose')).toBe(false)
    },
  )

  it('keeps every embedded converter behind a stable boundary and CSS Module layout class', () => {
    render(<RichText data={data} />)

    const banner = screen.getByTestId('embedded-banner')
    const media = screen.getByTestId('embedded-media')
    const code = screen.getByTestId('embedded-code')
    const ctaBoundary = screen.getByTestId('embedded-cta').parentElement

    expect(banner.classList).toContain('payload-richtext__embedded')
    expect(banner.classList).toContain(styles.embeddedBanner)
    expect(media.classList).toContain('payload-richtext__embedded')
    expect(media.classList).toContain(styles.embeddedMedia)
    expect(media.getAttribute('data-image-class')).toBe(styles.mediaImage)
    expect(media.getAttribute('data-caption-class')).toBe(styles.mediaCaption)
    expect(code.classList).toContain('payload-richtext__embedded')
    expect(code.classList).toContain(styles.embeddedCode)
    expect(ctaBoundary?.classList).toContain('payload-richtext__embedded')
    expect(ctaBoundary?.classList).toContain(styles.embeddedCTA)
  })

  it('lets nested content-enabled RichText establish a new content scope inside Block boundaries', () => {
    render(<RichText data={data} />)

    const mediaCaption = screen.getByTestId('media-caption-rich-text')
    const cta = screen.getByTestId('cta-rich-text')
    const banner = screen.getByTestId('banner-rich-text')

    expect(mediaCaption.closest('.payload-richtext__embedded')).not.toBeNull()
    expect(mediaCaption.classList).toContain('payload-richtext--content')
    expect(mediaCaption.querySelector('h2')?.textContent).toBe('Caption heading')
    expect(mediaCaption.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.com/caption',
    )
    expect(cta.closest('.payload-richtext__embedded')).not.toBeNull()
    expect(cta.classList).toContain('payload-richtext--content')
    expect(cta.querySelector('strong')?.textContent).toBe('emphasis')
    expect(cta.querySelector('li')?.textContent).toBe('CTA list item')
    expect(banner.classList).toContain('payload-richtext--plain')
    expect(banner.classList).not.toContain('payload-richtext--content')
    expect(contentStyles).toMatch(
      /@scope\s*\([^)]*\.payload-richtext--content[^)]*\)\s*to\s*\(\.payload-richtext__embedded\)/,
    )
  })

  it('keeps root-level prose spacing attached to the content scope', () => {
    const stylesheet = postcss.parse(contentStyles)
    const rootLevelRules: string[] = []

    stylesheet.walkRules((rule) => {
      if (rule.selector.includes(':scope >')) {
        rootLevelRules.push(rule.selector)
        expect(rule.parent?.type).toBe('atrule')
        expect((rule.parent as AtRule).name).toBe('scope')
      }
    })

    expect(rootLevelRules).toHaveLength(7)
  })

  it('preserves distinct gutter widths for content and plain modes', () => {
    expect(richTextStyles).toMatch(/\.root\s*{[^}]*max-width:\s*none;/s)
    expect(richTextStyles).toMatch(/\.withGutter\.content\s*{[^}]*max-width:\s*65ch;/s)
    for (const width of [40, 48, 64, 80, 86]) {
      expect(richTextStyles, `${width}rem container maximum`).toMatch(
        new RegExp(
          `@media \\(width >= ${width}rem\\)[^{}]*\\{[^{}]*\\.withGutter\\.plain\\s*\\{[^}]*max-width:\\s*${width}rem;`,
          's',
        ),
      )
    }
    expect(richTextStyles).not.toMatch(
      /\.withGutter\s*{[^}]*max-width:\s*var\(--website-container-site\)/s,
    )
  })

  it('uses the migrated inverse content contract for the real HighImpact consumer', () => {
    render(<HighImpactHero headerTheme="dark" richText={data} type="highImpact" />)

    expect(screen.getByTestId('rich-text').classList).toContain('payload-richtext--inverse')
    expect(contentStyles).toMatch(
      /:scope:where\(\.payload-richtext--inverse\)\s*{[^}]*--payload-richtext-links:\s*#fff;/s,
    )
    expect(contentStyles).toContain('--payload-richtext-pre-bg: rgb(0 0 0 / 50%);')
  })

  it('wires every RichText layout boundary through semantic CSS Module exports', () => {
    for (const slot of [
      'root',
      'content',
      'plain',
      'withGutter',
      'embeddedBanner',
      'embeddedMedia',
      'embeddedCode',
      'embeddedCTA',
      'mediaImage',
      'mediaCaption',
    ]) {
      expect(source, slot).toContain(`styles.${slot}`)
    }

    expect(source).not.toMatch(
      /(?:prose|md:prose-md|max-w-none|mx-auto|col-start-|col-span-|mb-4|max-w-\[48rem\])/,
    )
  })
})
