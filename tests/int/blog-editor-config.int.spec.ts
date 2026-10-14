import { describe, expect, it } from 'vitest'

describe('blog Lexical presets', () => {
  it('resolves the rich preset with article structure, formatting, toolbars, and registered internal links', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const { defaultLexical, defaultLexicalFeatures } = await import('@/fields/defaultLexical')
    const config = await configPromise
    const features = defaultLexical({ config, parentIsLocalized: false }).features
    const keys = features.map((feature) => feature.key)
    expect(keys).toEqual(defaultLexicalFeatures().map((feature) => feature.key))

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

  it('allows only the four article blocks in the Blog editor', async () => {
    const { default: configPromise } = await import('@/payload.config')
    const { defaultLexicalFeatures } = await import('@/fields/defaultLexical')
    const config = await configPromise
    const blogs = config.collections.find(({ slug }) => slug === 'blogs')!
    const fields = blogs.fields.flatMap((field) =>
      field.type === 'tabs' ? field.tabs.flatMap((tab) => tab.fields) : [field],
    )
    const content = fields.find((field) => 'name' in field && field.name === 'content')!
    expect(content).toMatchObject({ type: 'richText', required: true })
    const features = (
      content as unknown as {
        editor: {
          features: ReturnType<typeof import('@/fields/defaultLexical').defaultLexical>['features']
        }
      }
    ).editor.features
    expect(features.map((feature) => feature.key)).toEqual([
      ...defaultLexicalFeatures().map((feature) => feature.key),
      'blocks',
    ])
    expect(features.find((feature) => feature.key === 'blocks')?.serverFeatureProps).toMatchObject({
      blocks: ['mediaBlock', 'keyTakeaways', 'cta', 'banner'],
    })
    expect(
      features.find((feature) => feature.key === 'blocks')?.serverFeatureProps,
    ).not.toHaveProperty('inlineBlocks')
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
