import fs from 'node:fs'
import path from 'node:path'

import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/Link', () => ({ CMSLink: () => null }))
vi.mock('@/components/RichText', () => ({ default: () => null }))
vi.mock('@/fields/compactLexical', () => ({ compactLexical: {} }))

vi.mock('@/components/Media', () => ({
  Media: ({
    fill,
    imgClassName,
    presentation,
    size,
  }: {
    fill?: boolean
    imgClassName?: string
    presentation?: unknown
    size?: string
  }) => (
    <output
      data-fill={fill ? 'true' : 'false'}
      data-image-class={imgClassName}
      data-presentation={JSON.stringify(presentation)}
      data-size={size}
    />
  ),
}))

import { MediaBlock } from '@/collections/Pages/blocks/MediaBlock/Component'
import { MediaBlock as MediaBlockConfig } from '@/collections/Pages/blocks/MediaBlock/config'
import mediaBlockStyles from '@/collections/Pages/blocks/MediaBlock/Component.module.css'
import { Card } from '@/components/Card'
import cardStyles from '@/components/Card/index.module.css'
import { HighImpactHero } from '@/heros/HighImpact'
import { MediumImpactHero } from '@/heros/MediumImpact'
import { PostHero } from '@/heros/PostHero'

const readSource = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

const media = {
  alt: 'Tea plantation',
  createdAt: '2026-09-12T00:00:00.000Z',
  height: 800,
  id: 'media-id',
  mimeType: 'image/jpeg',
  updatedAt: '2026-09-12T01:02:03.000Z',
  url: 'https://assets.example.invalid/tea.jpg',
  width: 1200,
}

const getMediaBoundary = () => screen.getByRole('status')

afterEach(cleanup)

describe('existing media consumers', () => {
  it('declares the card crop while retaining its responsive size hint', () => {
    render(
      <Card
        doc={
          {
            categories: [],
            meta: { image: media },
            slug: 'tea',
            title: 'Tea',
          } as never
        }
        relationTo="posts"
      />,
    )

    expect(getMediaBoundary().getAttribute('data-presentation')).toBe(
      '{"image":{"aspectRatio":{"width":4,"height":3},"fit":"cover","quality":85}}',
    )
    expect(getMediaBoundary().getAttribute('data-size')).toBe('33vw')
    expect(screen.getByRole('article').getAttribute('data-slot')).toBe('content-card')
    expect(screen.getByRole('article').classList).toContain(cardStyles.card)
    expect(getMediaBoundary().parentElement?.getAttribute('data-slot')).toBe('content-card-media')
    expect(getMediaBoundary().parentElement?.classList).toContain(cardStyles.media)
  })

  it('declares original-ratio body presentation for Media Blocks', () => {
    render(<MediaBlock blockType="pageMediaBlock" media={media as never} />)

    expect(getMediaBoundary().getAttribute('data-presentation')).toBe(
      '{"image":{"fit":"scale-down","quality":85},"video":{"playback":"ambient"}}',
    )
    expect(getMediaBoundary().getAttribute('data-image-class')?.split(' ')).toContain(
      mediaBlockStyles.image,
    )
  })

  it.each([
    [
      'high-impact',
      () => render(<HighImpactHero headerTheme="dark" media={media as never} type="highImpact" />),
    ],
    [
      'medium-impact',
      () =>
        render(<MediumImpactHero headerTheme="light" media={media as never} type="mediumImpact" />),
    ],
    [
      'post',
      () =>
        render(
          <PostHero
            post={
              {
                categories: [],
                createdAt: '2026-09-12T00:00:00.000Z',
                heroImage: media,
                id: 'post-id',
                slug: 'tea',
                title: 'Tea',
                updatedAt: '2026-09-12T01:02:03.000Z',
              } as never
            }
          />,
        ),
    ],
  ])('declares non-cropping hero presentation for the %s renderer', (_name, renderHero) => {
    renderHero()

    expect(getMediaBoundary().getAttribute('data-presentation')).toBe(
      '{"image":{"fit":"scale-down","quality":85},"video":{"playback":"ambient"}}',
    )
  })

  it('preserves the existing fill presentation contract for overlay heroes', () => {
    render(<HighImpactHero headerTheme="dark" media={media as never} type="highImpact" />)

    expect(getMediaBoundary().getAttribute('data-fill')).toBe('true')
    expect(getMediaBoundary().getAttribute('data-presentation')).toBe(
      '{"image":{"fit":"scale-down","quality":85},"video":{"playback":"ambient"}}',
    )
    expect(readSource('src/heros/HighImpact/index.tsx')).toContain('imgClassName={styles.image}')
    expect(readSource('src/heros/HighImpact/index.module.css')).toMatch(
      /\.image\s*{[^}]*object-fit:\s*cover;/s,
    )
  })

  it('keeps the Post Hero fill image visually cropped beneath its overlay', () => {
    render(<PostHero post={{ categories: [], heroImage: media, title: 'Tea' } as never} />)

    expect(getMediaBoundary().getAttribute('data-fill')).toBe('true')
    expect(readSource('src/heros/PostHero/index.tsx')).toContain('imgClassName={styles.image}')
    expect(readSource('src/heros/PostHero/index.module.css')).toMatch(
      /\.image\s*{[^}]*object-fit:\s*cover;/s,
    )
  })
})

describe('video playback consumers', () => {
  it('declares the native Playback selector with Ambient as its default', () => {
    expect(
      MediaBlockConfig.fields.find((field) => 'name' in field && field.name === 'playback'),
    ).toMatchObject({
      type: 'select',
      defaultValue: 'ambient',
      options: [
        { label: 'Ambient', value: 'ambient' },
        { label: 'Player', value: 'player' },
      ],
    })
  })
  it('passes player playback alongside a Media Block crop', () => {
    render(
      <MediaBlock
        blockType="pageMediaBlock"
        media={media as never}
        playback="player"
        aspectRatio="16:9"
      />,
    )
    expect(JSON.parse(getMediaBoundary().getAttribute('data-presentation')!)).toMatchObject({
      image: { aspectRatio: { width: 16, height: 9 } },
      video: { playback: 'player' },
    })
  })
})
