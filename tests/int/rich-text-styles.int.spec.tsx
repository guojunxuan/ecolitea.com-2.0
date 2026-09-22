import { cleanup, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
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
    <div className={className} data-testid="embedded-banner" />
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
    />
  ),
}))

vi.mock('@/blocks/Code/Component', () => ({
  CodeBlock: ({ className }: { className?: string }) => (
    <div className={className} data-testid="embedded-code" />
  ),
}))

vi.mock('@/blocks/CallToAction/Component', () => ({
  CallToActionBlock: () => <div data-testid="embedded-cta" />,
}))

import RichText from '@/components/RichText'
import styles from '@/components/RichText/index.module.css'

afterEach(cleanup)

const data = { root: { children: [], type: 'root', version: 1 } } as never
const source = fs.readFileSync(
  path.join(process.cwd(), 'src/components/RichText/index.tsx'),
  'utf8',
)

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

  it('wires every RichText layout boundary through semantic CSS Module exports', () => {
    for (const slot of [
      'root',
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
