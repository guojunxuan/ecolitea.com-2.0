import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import type { Block, Field } from 'payload'
import { pageBlocks } from '@/collections/Pages/blocks'
import { caseStudyBlocks } from '@/collections/CaseStudies/blocks'
import { blogBlocks } from '@/collections/Blogs/blocks'
import { postBlocks } from '@/collections/Posts/blocks'
import { CardGroup, CategoryTabs, LinkGroup, RichCard } from '@/Header/blocks'

const owners = [
  [
    pageBlocks,
    'Pages',
    ['pageCta', 'pageContent', 'pageMediaBlock', 'pageArchive', 'pageFormBlock'],
  ],
  [caseStudyBlocks, 'Case Studies', ['caseStudyCta', 'caseStudyContent', 'caseStudyMediaBlock']],
  [blogBlocks, 'Blogs', ['blogMediaBlock', 'blogKeyTakeaways', 'blogCta', 'blogBanner']],
  [postBlocks, 'Posts', ['postBanner', 'postCode', 'postMediaBlock']],
  [
    [CategoryTabs, CardGroup, LinkGroup, RichCard],
    'Header',
    ['headerCategoryTabs', 'headerCardGroup', 'headerLinkGroup', 'headerRichCard'],
  ],
] as const

function* fields(fieldsToVisit: Field[]): Generator<Field> {
  for (const field of fieldsToVisit) {
    yield field
    if ('fields' in field) yield* fields(field.fields)
    if (field.type === 'tabs') for (const tab of field.tabs) yield* fields(tab.fields)
  }
}

describe('collection-owned block schemas', () => {
  it('keeps all 19 slugs/interfaces unique, ordered, explicitly labelled, and owner grouped', () => {
    const all = owners.flatMap(([blocks]) => blocks)
    expect(new Set(all.map((block) => block.slug)).size).toBe(19)
    expect(new Set(all.map((block) => block.interfaceName)).size).toBe(19)
    for (const [blocks, group, slugs] of owners) {
      expect(blocks.map((block) => block.slug)).toEqual(slugs)
      for (const block of blocks) {
        expect(block.admin?.group).toBe(group)
        expect(block.labels?.singular).toBeTruthy()
        expect(block.labels?.plural).toBeTruthy()
        const expectedLabels = block.slug.endsWith('MediaBlock')
          ? ['Media', 'Media']
          : block.slug.endsWith('KeyTakeaways')
            ? ['Key Points', 'Key Points']
            : block.slug.endsWith('Cta')
              ? ['Action Card', 'Action Cards']
              : block.slug.endsWith('Banner')
                ? ['Notice', 'Notices']
                : block.slug.endsWith('Content')
                  ? ['Content', 'Contents']
                  : block.slug.endsWith('Archive')
                    ? ['Archive', 'Archives']
                    : block.slug.endsWith('FormBlock')
                      ? ['Form Block', 'Form Blocks']
                      : block.slug.endsWith('Code')
                        ? ['Code', 'Codes']
                        : block.slug.endsWith('CategoryTabs')
                          ? ['Category Tabs', 'Category Tabs']
                          : block.slug.endsWith('CardGroup')
                            ? ['Card Group', 'Card Groups']
                            : block.slug.endsWith('LinkGroup')
                              ? ['Link Group', 'Link Groups']
                              : ['Rich Card', 'Rich Cards']
        expect(block.labels).toEqual({ singular: expectedLabels[0], plural: expectedLabels[1] })
        expect(block.interfaceName).toMatch(
          new RegExp(
            `^${group === 'Case Studies' ? 'CaseStudy' : group === 'Pages' ? 'Page' : group === 'Blogs' ? 'Blog' : group === 'Posts' ? 'Post' : 'Header'}`,
          ),
        )
      }
    }
    expect(pageBlocks.find((block) => block.slug === 'pageContent')?.labels).toEqual({
      singular: 'Content',
      plural: 'Contents',
    })
    expect(postBlocks.find((block) => block.slug === 'postCode')?.labels).toEqual({
      singular: 'Code',
      plural: 'Codes',
    })
    expect(pageBlocks.find((block) => block.slug === 'pageFormBlock')).not.toHaveProperty('graphQL')
    for (const blocks of [pageBlocks, caseStudyBlocks])
      for (const block of blocks) expect(block.admin?.components ?? {}).not.toHaveProperty('Block')
    for (const block of [...blogBlocks, ...postBlocks.filter((block) => block.slug !== 'postCode')])
      expect(block.admin?.components?.Block).toBe('@/blocks/ArticleBlockEditor#ArticleBlockEditor')
  })

  it('registers only owner arrays on fields and keeps nested rich text free of block nodes', async () => {
    const config = await (await import('@/payload.config')).default
    expect(config.blocks).toEqual([])
    const header = config.globals.find((global) => global.slug === 'header')!
    const navigation = [...fields(header.fields)].find(
      (field) => 'name' in field && field.name === 'content' && field.type === 'blocks',
    )!
    expect(navigation).toMatchObject({
      type: 'blocks',
      blocks: owners[4][2].map((slug) => expect.objectContaining({ slug })),
    })
    for (const [slug, expected] of [
      ['pages', pageBlocks],
      ['case-studies', caseStudyBlocks],
    ] as const) {
      const collection = config.collections.find((collection) => collection.slug === slug)!
      const layout = [...fields(collection.fields)].find(
        (field) => 'name' in field && field.name === 'layout',
      )
      expect(layout).toMatchObject({
        type: 'blocks',
        required: true,
        blocks: expected.map((block) => expect.objectContaining({ slug: block.slug })),
      })
    }
    for (const [slug, expected] of [
      ['blogs', blogBlocks],
      ['posts', postBlocks],
    ] as const) {
      const collection = config.collections.find((collection) => collection.slug === slug)!
      const content = [...fields(collection.fields)].find(
        (field) => 'name' in field && field.name === 'content',
      )!
      const editor = (
        content as unknown as {
          editor: { features: Array<{ key: string; serverFeatureProps?: { blocks?: Block[] } }> }
        }
      ).editor
      const configured = editor.features.find((feature) => feature.key === 'blocks')!
        .serverFeatureProps!.blocks!
      expect(configured.map((block) => block.slug)).toEqual(expected.map((block) => block.slug))
    }
    for (const [blocks] of owners.slice(0, 4))
      for (const block of blocks) {
        for (const field of fields(block.fields))
          if (field.type === 'richText') {
            const editor = field.editor
            const resolved = (typeof editor === 'function'
              ? editor({ config, parentIsLocalized: false })
              : editor) as unknown as { features: Array<{ key: string }> }
            expect(resolved.features.map((feature) => feature.key)).not.toContain('blocks')
          }
      }
  }, 15000)

  it('keeps shared RichText independent and generated Block interfaces free of hashes', () => {
    const source = readFileSync('src/components/RichText/index.tsx', 'utf8')
    expect(source).not.toMatch(/from ['"].*\/blocks\//)
    const generated = readFileSync('src/payload-types.ts', 'utf8')
    expect(generated).not.toMatch(
      /interface (?:ArchiveBlock|ContentBlock|FormBlock|CodeBlock|MediaBlock|KeyTakeawaysBlock|CallToActionBlock|BannerBlock)\b/,
    )
    expect(generated).not.toMatch(/Block_[A-F0-9]{8}/)
  })
})
