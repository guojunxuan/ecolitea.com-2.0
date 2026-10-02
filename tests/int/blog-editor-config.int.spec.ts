import { describe, expect, it } from 'vitest'

describe('blog Lexical presets', () => {
  it('resolves the rich preset with article structure, formatting, toolbars, and registered internal links', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const { defaultLexical } = await import('@/fields/defaultLexical')
    const config = await configPromise
    const features = defaultLexical({ config, parentIsLocalized: false }).features
    const keys = features.map((feature) => feature.key)

    expect(keys).toEqual(
      expect.arrayContaining([
        'paragraph',
        'heading',
        'blockquote',
        'horizontalRule',
        'table',
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'inlineCode',
        'superscript',
        'subscript',
        'orderedList',
        'unorderedList',
        'link',
        'toolbarFixed',
        'toolbarInline',
      ]),
    )
    expect(features.find((feature) => feature.key === 'heading')?.serverFeatureProps).toEqual({
      enabledHeadingSizes: ['h2', 'h3', 'h4'],
    })
    expect(features.find((feature) => feature.key === 'link')?.serverFeatureProps).toMatchObject({
      enabledCollections: ['pages', 'posts', 'blogs', 'blog-categories', 'case-studies'],
    })
  }, 15_000)

  it('resolves the compact preset with text, links, and lists but no structural blocks', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const { compactLexical } = await import('@/fields/compactLexical')
    const config = await configPromise
    const features = compactLexical({ config, parentIsLocalized: false }).features
    const keys = features.map((feature) => feature.key)

    expect(keys).toEqual(
      expect.arrayContaining([
        'paragraph',
        'bold',
        'italic',
        'underline',
        'strikethrough',
        'inlineCode',
        'superscript',
        'subscript',
        'orderedList',
        'unorderedList',
        'link',
        'toolbarFixed',
        'toolbarInline',
      ]),
    )
    for (const key of ['heading', 'table', 'blockquote', 'horizontalRule']) {
      expect(keys).not.toContain(key)
    }
    expect(features.find((feature) => feature.key === 'link')?.serverFeatureProps).toMatchObject({
      enabledCollections: ['pages', 'posts', 'blogs', 'blog-categories', 'case-studies'],
    })
  }, 15_000)
})
