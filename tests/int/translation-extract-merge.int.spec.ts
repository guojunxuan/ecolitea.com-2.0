import { describe, expect, it } from 'vitest'
import { extract } from '@/plugins/translation/extract'
import { merge, mergeWithDiagnostics } from '@/plugins/translation/merge'
import { decodeEntities } from '@/plugins/translation/lexical'
import type { TranslationRule } from '@/plugins/translation/rules'

const text = (value: string, format = 0) => ({ type: 'text', text: value, format, version: 1 })
const paragraph = (...children: object[]) => ({ type: 'paragraph', children, version: 1 })
const lexical = (...children: object[]) => ({ root: { type: 'root', children, version: 1 } })

describe('translation extraction and merging', () => {
  const rule: TranslationRule = {
    title: 'translate',
    slug: 'exclude',
    'sections[].blocks[blockType=productMediaText].heading': 'translate',
    'sections[].blocks[blockType=productMediaText].body': 'translate',
  }
  const doc = {
    id: 'source',
    title: 'Tea',
    slug: 'tea',
    count: 3,
    relationship: 'related',
    media: { id: 'asset', url: '/tea.png' },
    sections: [
      {
        id: 'section',
        blocks: [
          {
            id: 'first',
            blockType: 'productMediaText',
            heading: 'Tea',
            body: lexical(paragraph(text('Body'))),
          },
          { id: 'other', blockType: 'unknown', heading: 'Private' },
        ],
      },
    ],
  }

  it('extracts only declared text with stable row IDs and retains paths sharing a source for fanout', () => {
    expect(extract(doc, rule)).toEqual([
      { path: 'title', kind: 'text', source: 'Tea' },
      { path: 'sections[id=section].blocks[id=first].heading', kind: 'text', source: 'Tea' },
      {
        path: 'sections[id=section].blocks[id=first].body.root.children[0]',
        kind: 'richtext-paragraph',
        source: '<x0>Body</x0>',
      },
    ])
  })

  it('merges into a clone, preserves nontext properties, and ignores untrusted paths', () => {
    const translated = merge(
      doc,
      {
        title: 'Tee',
        slug: 'changed',
        count: '4',
        'media.url': '/changed.png',
        'sections[id=section].blocks[id=first].heading': 'Überschrift',
        'sections[id=section].blocks[id=other].heading': 'Changed',
      },
      rule,
    )
    expect(translated.title).toBe('Tee')
    expect(translated.sections[0].blocks[0].heading).toBe('Überschrift')
    expect(translated).toMatchObject({
      id: 'source',
      slug: 'tea',
      count: 3,
      relationship: 'related',
      media: doc.media,
    })
    expect(translated.sections[0].blocks[1].heading).toBe('Private')
    expect(doc.title).toBe('Tea')
    expect(translated).not.toBe(doc)
    expect(translated.media).not.toBe(doc.media)
  })

  it('resolves rows after reorder and never recreates a deleted row', () => {
    const current = {
      rows: [
        { id: 'second', title: 'Second' },
        { id: 'first', title: 'First' },
      ],
    }
    const fields = { 'rows[id=first].title': 'Erste', 'rows[id=deleted].title': 'Removed' }
    expect(merge(current, fields, { 'rows[].title': 'translate' }).rows).toEqual([
      { id: 'second', title: 'Second' },
      { id: 'first', title: 'Erste' },
    ])
  })

  it('encodes row IDs and skips arrays without stable row IDs', () => {
    const current = { rows: [{ id: 'a.b]c', title: 'One' }, { title: 'Unsaved' }] }
    const entries = extract(current, { 'rows[].title': 'translate' })
    expect(entries).toEqual([{ path: 'rows[id=a.b%5Dc].title', kind: 'text', source: 'One' }])
    expect(
      merge(current, { [entries[0].path]: 'Eins' }, { 'rows[].title': 'translate' }).rows[0].title,
    ).toBe('Eins')
  })

  it('does not treat arbitrary objects, numbers, or empty text as translatable values', () => {
    expect(
      extract(
        { count: 12, media: { id: 'asset' }, empty: '', title: null },
        {
          count: 'translate',
          media: 'translate',
          empty: 'translate',
          title: 'translate',
        },
      ),
    ).toEqual([])
  })
})

describe('indexed Lexical paragraph translation', () => {
  const original = lexical(
    paragraph(
      text('Tea & ', 1),
      {
        type: 'link',
        fields: { url: 'https://tea.example.invalid', linkType: 'custom' },
        children: [text('leaves')],
      },
      { type: 'linebreak', version: 1 },
      text('today'),
    ),
  )
  const rule: TranslationRule = { content: 'translate' }

  it('serializes a paragraph with escaped text, nested link tags, and nontext placeholders', () => {
    expect(extract({ content: original }, rule)).toEqual([
      {
        path: 'content.root.children[0]',
        kind: 'richtext-paragraph',
        source: '<x0>Tea &amp; </x0><x1><x2>leaves</x2></x1><x3/><x4>today</x4>',
      },
    ])
  })

  it('restores translated text while retaining bold, link attributes, and line breaks', () => {
    const result = mergeWithDiagnostics(
      { content: original },
      {
        'content.root.children[0]':
          '<x0>Tee &amp; </x0><x1><x2>Blätter</x2></x1><x3/><x4>heute</x4>',
      },
      rule,
    )
    expect(result.degraded).toBe(0)
    expect(result.doc.content).toEqual(
      lexical(
        paragraph(
          text('Tee & ', 1),
          {
            type: 'link',
            fields: { url: 'https://tea.example.invalid', linkType: 'custom' },
            children: [text('Blätter')],
          },
          { type: 'linebreak', version: 1 },
          text('heute'),
        ),
      ),
    )
    expect(original.root.children[0].children[0]).toEqual(text('Tea & ', 1))
  })

  it.each([
    '<x0>Tee</x0>',
    '<x0>Tee</x0><x0>duplicate</x0><x1><x2>Blätter</x2></x1><x3/><x4>heute</x4>',
    '<x1><x2>Blätter</x2></x1><x0>Tee</x0><x3/><x4>heute</x4>',
    '<x0>Tee</x0><x1><x2>Blätter</x1></x2><x3/><x4>heute</x4>',
  ])(
    'degrades malformed, duplicate, reordered, or wrongly nested tags without throwing',
    (translated) => {
      const result = mergeWithDiagnostics(
        { content: original },
        { 'content.root.children[0]': translated },
        rule,
      )
      expect(result.degraded).toBe(1)
      const children = result.doc.content.root.children[0].children as Record<string, unknown>[]
      expect(children[0].text).not.toBe('Tea & ')
      expect(children[0].text).not.toContain('<x')
      expect(children[0].format).toBe(1)
      expect((children[1].children as Record<string, unknown>[])[0].text).toBe('')
      expect(children[1].fields).toEqual({ url: 'https://tea.example.invalid', linkType: 'custom' })
      expect(children[2].type).toBe('linebreak')
      expect(children[3].text).toBe('')
    },
  )

  it('extracts headings, quotes and list items while skipping code, uploads, relationships and arbitrary blocks', () => {
    const document = lexical(
      { type: 'heading', tag: 'h2', children: [text('Heading')] },
      { type: 'quote', children: [text('Quote')] },
      {
        type: 'list',
        children: [
          {
            type: 'listitem',
            children: [
              text('Item'),
              { type: 'list', children: [{ type: 'listitem', children: [text('Nested')] }] },
            ],
          },
        ],
      },
      { type: 'code', children: [paragraph(text('Code'))] },
      { type: 'upload', children: [paragraph(text('Upload'))] },
      { type: 'relationship', children: [paragraph(text('Related'))] },
      { type: 'block', fields: { id: 'private', blockType: 'unknown', title: 'Do not translate' } },
    )
    expect(extract({ content: document }, rule).map(({ source }) => source)).toEqual([
      '<x0>Heading</x0>',
      '<x0>Quote</x0>',
      '<x0>Item</x0><x1/>',
      '<x0>Nested</x0>',
    ])
  })

  it('translates only explicitly declared embedded Block fields, addressed by stable fields.id', () => {
    const block = (id: string, heading: string) => ({
      type: 'block',
      fields: {
        id,
        blockType: 'blogCta',
        heading,
        description: lexical(paragraph(text('Description'))),
      },
    })
    const document = {
      content: lexical(block('first', 'First'), block('second', 'Second'), {
        type: 'block',
        fields: { id: 'unknown', blockType: 'unknown', heading: 'Private' },
      }),
    }
    const blocksRule: TranslationRule = {
      content: 'translate',
      'content[blockType=blogCta].heading': 'translate',
      'content[blockType=blogCta].description': 'translate',
    }
    const entries = extract(document, blocksRule)
    expect(entries.map(({ path }) => path)).toEqual([
      'content[block-id=first].heading',
      'content[block-id=second].heading',
      'content[block-id=first].description.root.children[0]',
      'content[block-id=second].description.root.children[0]',
    ])
    document.content.root.children.reverse()
    const result = merge(document, { 'content[block-id=first].heading': 'Erste' }, blocksRule)
    expect(result.content.root.children[2]).toMatchObject({
      fields: { id: 'first', heading: 'Erste' },
    })
    expect(result.content.root.children[0]).toMatchObject({ fields: { heading: 'Private' } })
  })

  it('decodes basic named and numeric entities without DOM support', () => {
    expect(decodeEntities('&lt;&gt;&quot;&apos;&nbsp;&amp;&#39;&#x1F375;')).toBe("<>\"'\u00a0&'🍵")
    expect(decodeEntities('&#99999999; &unknown; &amp;lt;')).toBe('&#99999999; &unknown; &lt;')
  })
})
