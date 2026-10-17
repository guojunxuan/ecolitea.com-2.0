import { existsSync, readFileSync } from 'node:fs'
import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Block, Field } from 'payload'
import type { KeyTakeawaysBlock as TakeawaysProps } from '@/payload-types'

vi.mock('@/components/Media', () => ({
  Media: ({ presentation }: { presentation: unknown }) => (
    <output data-testid="media" data-presentation={JSON.stringify(presentation)} />
  ),
}))
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => <svg /> }))

import { BannerBlock } from '@/blocks/Banner/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import RichText from '@/components/RichText'

const components = import.meta.glob('/src/blocks/KeyTakeaways/Component.tsx', {
  eager: true,
}) as Record<
  string,
  {
    KeyTakeawaysBlock: React.ComponentType<TakeawaysProps>
  }
>
const richText = (text: string) =>
  ({
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          version: 1,
          children: [
            { type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' },
          ],
        },
      ],
    },
  }) as never
const media = { id: 'tea', caption: richText('Media caption') } as never
const field = (block: Block, name: string) =>
  block.fields.find((entry) => 'name' in entry && entry.name === name)
const metadata = [
  ['mediaBlock', 'MediaBlock', 'Media', 'Media', 'Media', 'media'],
  ['keyTakeaways', 'KeyTakeawaysBlock', 'Key Points', 'Key Points', 'Content', 'key-takeaways'],
  ['cta', 'CallToActionBlock', 'Action Card', 'Action Cards', 'Conversion', 'cta'],
  ['banner', 'BannerBlock', 'Notice', 'Notices', 'Content', 'banner'],
]

afterEach(cleanup)

describe('editorial block schema', () => {
  it('registers shared blocks once with usable Admin metadata and required content fields', async () => {
    const config = await (await import('@/payload.config')).default
    expect(config.blocks?.map(({ slug }) => slug)).toEqual([
      'archive',
      'content',
      'formBlock',
      'code',
      'mediaBlock',
      'keyTakeaways',
      'cta',
      'banner',
    ])
    for (const [slug, interfaceName, singular, plural, group, image] of metadata) {
      const block = config.blocks!.find((entry) => entry.slug === slug)!
      expect(block).toMatchObject({
        interfaceName,
        labels: { singular, plural },
        admin: {
          group,
          disableBlockName: true,
          images: {
            icon: `/block-previews/${image}.svg`,
            thumbnail: `/block-previews/${image}.svg`,
          },
          components: {
            Block: '@/blocks/ArticleBlockEditor#ArticleBlockEditor',
            Label: {
              path: '@/blocks/BlockRowLabel#BlockRowLabel',
              clientProps: { blockType: slug },
            },
          },
        },
      })
      expect(existsSync(`public/block-previews/${image}.svg`)).toBe(true)
      const required = slug === 'cta' ? 'heading' : slug === 'mediaBlock' ? 'media' : 'content'
      expect(field(block, required)).toMatchObject({ required: true })
    }
    const cta = config.blocks!.find((entry) => entry.slug === 'cta')!
    expect(field(cta, 'links')).toMatchObject({ type: 'array', maxRows: 2 })
    expect(field(cta, 'richText')).toBeUndefined()
    const theme = field(cta, 'theme')
    expect(theme).toMatchObject({
      type: 'select',
      admin: { isClearable: true, placeholder: 'Inherit surrounding theme' },
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Inverse', value: 'inverse' },
      ],
    })
    expect(theme).not.toHaveProperty('defaultValue')
    expect(theme).not.toHaveProperty('required', true)
    const mediaBlock = config.blocks!.find((entry) => entry.slug === 'mediaBlock')!
    expect(field(mediaBlock, 'caption')).toMatchObject({ type: 'richText' })
    expect(field(mediaBlock, 'aspectRatio')).toMatchObject({
      type: 'select',
      defaultValue: 'original',
      options: ['original', '1:1', '4:3', '3:2', '16:9', '2:1'].map((value) => ({
        label: value === 'original' ? 'Original' : value,
        value,
      })),
    })
    expect(field(mediaBlock, 'width')).toMatchObject({
      admin: { hidden: true },
      defaultValue: 'default',
      options: [
        { label: 'Default', value: 'default' },
        { label: 'Wide', value: 'wide' },
      ],
    })
    expect(
      field(
        config.blocks!.find((entry) => entry.slug === 'keyTakeaways')!,
        'label',
      ),
    ).not.toHaveProperty('defaultValue')
  }, 15000)

  it('retains collection layout allowlists using root block slugs', async () => {
    const { Pages } = await import('@/collections/Pages')
    const { CaseStudies } = await import('@/collections/CaseStudies')
    function layout(fields: Field[]): Field | undefined {
      for (const entry of fields) {
        if ('name' in entry && entry.name === 'layout') return entry
        if (entry.type === 'tabs')
          for (const tab of entry.tabs) {
            const found = layout(tab.fields)
            if (found) return found
          }
      }
    }
    expect(layout(Pages.fields)).toMatchObject({
      blocks: ['cta', 'content', 'mediaBlock', 'archive', 'formBlock'],
    })
    expect(layout(CaseStudies.fields)).toMatchObject({ blocks: ['cta', 'content', 'mediaBlock'] })
  })
})

describe('editorial block rendering', () => {
  it('renders takeaways as a readable aside', () => {
    const Takeaways = components['/src/blocks/KeyTakeaways/Component.tsx']?.KeyTakeawaysBlock
    expect(Takeaways).toBeDefined()
    render(
      <>
        <Takeaways id="takeaways" blockType="keyTakeaways" content={richText('Remember this')} />
      </>,
    )
    expect(screen.queryByRole('heading')).toBeNull()
    expect(screen.getByRole('complementary', { name: 'Key Points' })).toBeTruthy()
    expect(screen.getByRole('complementary').textContent).toContain('Remember this')
  })

  it.each(['info', 'warning', 'error', 'success'] as const)(
    'renders an accessible %s banner with optional title',
    (style) => {
      render(
        <BannerBlock
          {...{
            blockType: 'banner',
            style,
            title: 'Notice title',
            content: richText('Notice body'),
          }}
        />,
      )
      expect(screen.getByRole('note', { name: 'Notice title' }).textContent).toContain(
        'Notice body',
      )
      expect(screen.getByRole('heading', { name: 'Notice title' })).toBeTruthy()
    },
  )

  it('prefers block captions, falls back to media captions, and omits missing captions', () => {
    const { rerender, container } = render(
      <MediaBlock
        {...{
          blockType: 'mediaBlock' as const,
          media,
          caption: richText('Block caption'),
          width: 'wide' as const,
        }}
      />,
    )
    expect(screen.getByText('Block caption').closest('figcaption')).toBeTruthy()
    expect(screen.queryByText('Media caption')).toBeNull()
    expect(screen.getByTestId('media').getAttribute('data-presentation')).toBe(
      '{"image":{"fit":"scale-down","quality":85},"video":{"playback":"ambient"}}',
    )
    expect(container.querySelector('figure')?.getAttribute('data-width')).toBe('wide')
    rerender(<MediaBlock blockType="mediaBlock" media={media} />)
    expect(screen.getByText('Media caption')).toBeTruthy()
    rerender(<MediaBlock blockType="mediaBlock" media="unpopulated" />)
    expect(container.querySelector('figcaption')).toBeNull()
  })

  it.each(['1:1', '4:3', '3:2', '16:9', '2:1'] as const)(
    'passes the %s crop ratio through the shared media renderer',
    (aspectRatio) => {
      const { container } = render(
        <MediaBlock
          blockType="mediaBlock"
          media={media}
          aspectRatio={aspectRatio}
          caption={richText('Outside crop')}
        />,
      )
      const [width, height] = aspectRatio.split(':').map(Number)
      expect(
        JSON.parse(screen.getByTestId('media').getAttribute('data-presentation')!),
      ).toMatchObject({
        image: { aspectRatio: { width, height }, fit: 'cover' },
      })
      expect(
        container.querySelector('figure')?.style.getPropertyValue('--media-aspect-ratio'),
      ).toBe(`${width} / ${height}`)
      expect(screen.getByText('Outside crop').closest('figcaption')).toBeTruthy()
    },
  )

  it('keeps original proportions without a crop frame for Original', () => {
    const { container } = render(
      <MediaBlock blockType="mediaBlock" media={media} aspectRatio="original" />,
    )
    expect(JSON.parse(screen.getByTestId('media').getAttribute('data-presentation')!)).toEqual({
      image: { fit: 'scale-down', quality: 85 },
      video: { playback: 'ambient' },
    })
    expect(container.querySelector('figure')?.style.getPropertyValue('--media-aspect-ratio')).toBe(
      '',
    )
  })

  it('renders CTA text and image variants, themes and shared links', () => {
    const props = {
      blockType: 'cta' as const,
      heading: 'Explore tea',
      description: richText('Find your blend'),
      links: [
        {
          link: {
            type: 'custom' as const,
            label: 'Browse',
            url: '/tea',
            appearance: 'outline' as const,
          },
        },
      ],
    }
    const { rerender, container } = render(<CallToActionBlock {...props} />)
    expect(screen.getByRole('heading', { name: 'Explore tea' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Browse' }).getAttribute('href')).toBe('/tea')
    expect(screen.queryByTestId('media')).toBeNull()
    rerender(<CallToActionBlock {...{ ...props, media, theme: 'inverse' as const }} />)
    expect(screen.getByText('Find your blend')).toBeTruthy()
    expect(screen.getByTestId('media').closest('[data-website-theme="inverse"]')).toBeTruthy()
    expect(container.querySelector('[data-website-theme="inverse"]')).toBeTruthy()
  })

  it('retains embedded Post Banner, Media and Code converters with upgraded fields', () => {
    const content = {
      root: {
        type: 'root',
        version: 1,
        children: [
          {
            type: 'block',
            version: 2,
            fields: {
              blockType: 'banner',
              style: 'info',
              title: 'Embedded notice',
              content: richText('Notice'),
            },
          },
          {
            type: 'block',
            version: 2,
            fields: {
              blockType: 'mediaBlock',
              media,
              caption: richText('Embedded caption'),
              width: 'wide',
            },
          },
          {
            type: 'block',
            version: 2,
            fields: { blockType: 'code', language: 'js', code: 'const tea = true' },
          },
        ],
      },
    } as never
    const { container } = render(<RichText data={content} />)
    expect(screen.getByRole('note', { name: 'Embedded notice' })).toBeTruthy()
    expect(screen.getByText('Embedded caption')).toBeTruthy()
    expect(container.querySelector('pre')?.textContent).toContain('const tea = true')
  })

  it.each(['MediaBlock', 'KeyTakeaways', 'CallToAction', 'Banner'])(
    'uses semantic colors in %s',
    (name) => {
      const path = `src/blocks/${name}/Component.module.css`
      expect(existsSync(path)).toBe(true)
      expect(readFileSync(path, 'utf8')).not.toMatch(/#[\da-f]{3,8}\b|rgba?\(|hsla?\(/i)
    },
  )
})
