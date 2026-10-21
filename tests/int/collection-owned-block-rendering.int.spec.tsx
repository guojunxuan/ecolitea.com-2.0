import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock('@/components/Media', () => ({ Media: () => <div data-testid="media" /> }))
vi.mock('@payloadcms/ui/icons/Copy', () => ({ CopyIcon: () => <svg /> }))
vi.mock('@/collections/Pages/blocks/Archive/Component', () => ({
  ArchiveBlock: () => <div>Archive</div>,
}))

import RichText, { richTextEmbedClassNames } from '@/components/RichText'
import pageStyles from '@/collections/Pages/blocks/RenderPageBlocks.module.css'
import caseStudyStyles from '@/collections/CaseStudies/blocks/RenderCaseStudyBlocks.module.css'
import { blogRichTextBlocks } from '@/collections/Blogs/blocks/richTextBlocks'
import { postRichTextBlocks } from '@/collections/Posts/blocks/richTextBlocks'
import { RenderPageBlocks } from '@/collections/Pages/blocks/RenderPageBlocks'
import { RenderCaseStudyBlocks } from '@/collections/CaseStudies/blocks/RenderCaseStudyBlocks'

const text = (value: string) =>
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
            {
              type: 'text',
              version: 1,
              text: value,
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
            },
          ],
        },
      ],
    },
  }) as never
const content = (fields: Record<string, unknown>[]) =>
  ({
    root: {
      type: 'root',
      version: 1,
      direction: null,
      format: '',
      indent: 0,
      children: fields.map((field, index) => ({
        type: 'block',
        version: 2,
        format: '',
        fields: { id: `block-${index}`, ...field },
      })),
    },
  }) as never

afterEach(cleanup)

describe('owner rendering boundaries', () => {
  it('renders Blog converters through real RichText with article wrappers', () => {
    const { container } = render(
      <RichText
        context="article"
        blocks={blogRichTextBlocks}
        data={content([
          { blockType: 'blogBanner', style: 'info', content: text('Blog notice') },
          { blockType: 'blogCta', heading: 'Blog action' },
          { blockType: 'blogKeyTakeaways', content: text('Blog summary') },
          { blockType: 'blogMediaBlock', media: { id: 'image' }, caption: text('Blog caption') },
        ])}
      />,
    )
    expect(container.querySelectorAll('.payload-richtext__embedded')).toHaveLength(4)
    for (const wrapper of container.querySelectorAll('.payload-richtext__embedded'))
      expect(wrapper.classList).toContain(richTextEmbedClassNames.articleBlock)
    for (const value of ['Blog notice', 'Blog action', 'Blog summary', 'Blog caption'])
      expect(screen.getByText(value)).toBeTruthy()
  })

  it('renders Post converters through real RichText preserving embedded classes and captions', () => {
    const { container } = render(
      <RichText
        blocks={postRichTextBlocks}
        data={content([
          { blockType: 'postBanner', style: 'info', content: text('Post notice') },
          { blockType: 'postCode', code: 'const tea = true', language: 'typescript' },
          { blockType: 'postMediaBlock', media: { id: 'image' }, caption: text('Post caption') },
        ])}
      />,
    )
    expect(container.querySelectorAll('.payload-richtext__embedded')).toHaveLength(3)
    const wrappers = [...container.querySelectorAll('.payload-richtext__embedded')]
    expect(wrappers[0].classList).toContain(richTextEmbedClassNames.banner)
    expect(wrappers[1].classList).toContain(richTextEmbedClassNames.code)
    expect(wrappers[2].classList).toContain(richTextEmbedClassNames.media)
    expect(screen.getByText('Post notice')).toBeTruthy()
    expect(screen.getByText('Post caption').closest('figcaption')).toBeTruthy()
    expect(container.querySelector('pre')?.textContent).toContain('const tea = true')
  })

  it('does not render block nodes without owner converters', () => {
    const { container } = render(
      <RichText data={content([{ blockType: 'blogCta', heading: 'Hidden' }])} />,
    )
    expect(container.querySelector('.payload-richtext__embedded')).toBeNull()
    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('keeps layout wrappers, owner allowlists, and unresolved Form protection', () => {
    const { container, rerender } = render(
      <RenderPageBlocks
        blocks={[
          { blockType: 'pageContent', columns: [] },
          { blockType: 'pageCta', heading: 'Page action' },
          { blockType: 'pageMediaBlock', media: 'missing' },
          { blockType: 'pageArchive', populateBy: 'selection' },
          {
            blockType: 'pageFormBlock',
            form: {
              id: 'form',
              title: 'Contact',
              fields: [],
              submitButtonLabel: 'Send',
              confirmationType: 'message',
            } as never,
          },
          { blockType: 'pageFormBlock', form: 'missing' },
        ]}
      />,
    )
    expect(container.children).toHaveLength(5)
    for (const wrapper of container.children)
      expect(wrapper.classList).toContain(pageStyles.section)
    expect(screen.getByText('Page action')).toBeTruthy()
    rerender(
      <RenderCaseStudyBlocks
        blocks={[
          { blockType: 'caseStudyContent', columns: [] },
          { blockType: 'caseStudyCta', heading: 'Case action' },
          { blockType: 'caseStudyMediaBlock', media: 'missing' },
        ]}
      />,
    )
    expect(container.children).toHaveLength(3)
    for (const wrapper of container.children)
      expect(wrapper.classList).toContain(caseStudyStyles.section)
    expect(screen.getByText('Case action')).toBeTruthy()
    rerender(<RenderCaseStudyBlocks blocks={[{ blockType: 'unknown' }] as never} />)
    expect(container.children).toHaveLength(0)
  })
})
