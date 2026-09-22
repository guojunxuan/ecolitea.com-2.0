import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('@/components/Link', () => ({ CMSLink: () => null }))
vi.mock('@/components/RichText', () => ({ default: () => null }))

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

import { MediaBlock } from '@/blocks/MediaBlock/Component'
import mediaBlockStyles from '@/blocks/MediaBlock/Component.module.css'
import { Card } from '@/components/Card'
import cardStyles from '@/components/Card/index.module.css'
import { HighImpactHero } from '@/heros/HighImpact'
import { MediumImpactHero } from '@/heros/MediumImpact'
import { PostHero } from '@/heros/PostHero'

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
    render(<MediaBlock blockType="mediaBlock" media={media as never} />)

    expect(getMediaBoundary().getAttribute('data-presentation')).toBe(
      '{"image":{"fit":"scale-down","quality":85}}',
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
      '{"image":{"fit":"scale-down","quality":85}}',
    )
  })

  it('preserves the existing fill presentation contract for overlay heroes', () => {
    render(<HighImpactHero headerTheme="dark" media={media as never} type="highImpact" />)

    expect(getMediaBoundary().getAttribute('data-fill')).toBe('true')
    expect(getMediaBoundary().getAttribute('data-presentation')).toBe(
      '{"image":{"fit":"scale-down","quality":85}}',
    )
  })
})
