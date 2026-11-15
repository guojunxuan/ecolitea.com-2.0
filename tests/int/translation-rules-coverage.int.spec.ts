// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Block, Field, RichTextAdapter, SanitizedConfig } from 'payload'

import configPromise from '@/payload.config'
import {
  getTranslationRule,
  parseRulePath,
  RULE_VERSION,
  translationRules,
  type TranslationRule,
} from '@/plugins/translation/rules'

const join = (prefix: string, name?: string) => [prefix, name].filter(Boolean).join('.')

function textPaths(config: SanitizedConfig, fields: Field[], prefix = ''): string[] {
  const paths: string[] = []
  const inspectBlocks = (blocks: (Block | string)[], parent: string) => {
    for (const reference of blocks) {
      const block =
        typeof reference === 'string'
          ? config.blocks?.find((candidate) => candidate.slug === reference)
          : reference
      if (!block) throw new Error(`Unresolved block: ${String(reference)}`)
      paths.push(...textPaths(config, block.fields, `${parent}[blockType=${block.slug}]`))
    }
  }
  for (const field of fields) {
    const path = join(prefix, 'name' in field ? field.name : undefined)
    if (['text', 'textarea', 'richText', 'slug'].includes(field.type)) paths.push(path)
    if (field.type === 'tabs') {
      for (const tab of field.tabs)
        paths.push(
          ...textPaths(config, tab.fields, join(prefix, 'name' in tab ? tab.name : undefined)),
        )
    } else if (field.type === 'array') {
      paths.push(...textPaths(config, field.fields, `${path}[]`))
    } else if (field.type === 'blocks') {
      inspectBlocks(field.blocks, path)
    } else if ('fields' in field) {
      paths.push(...textPaths(config, field.fields, path))
    }
    if (field.type === 'richText' && typeof field.editor === 'object') {
      // Public adapter API includes the sanitized fields of embedded Lexical Blocks.
      // These schema generators do not need translated Admin labels for this inspection.
      const adapter: RichTextAdapter = field.editor
      const schemas = adapter.generateSchemaMap?.({
        config,
        field,
        i18n: {} as never,
        schemaMap: new Map(),
        schemaPath: path,
      })
      const seen = new Set<string>()
      for (const entry of schemas?.values() ?? []) {
        if ('type' in entry && entry.type === 'blocks') {
          const blocks = entry.blocks.filter((block) => {
            const slug = typeof block === 'string' ? block : block.slug
            if (seen.has(slug)) return false
            seen.add(slug)
            return true
          })
          inspectBlocks(blocks, path)
        }
      }
    }
  }
  return paths
}

function missingPaths(paths: string[], rule: TranslationRule) {
  return paths.filter((path) => !Object.hasOwn(rule, path))
}

describe('translation field declarations', () => {
  it('covers every sanitized text field, including embedded Lexical Blocks, arrays and named tabs', async () => {
    const config = await configPromise
    const missing: string[] = []
    for (const [source, rule] of Object.entries(translationRules)) {
      const owner = source.startsWith('global:')
        ? config.globals.find(({ slug }) => slug === source.slice(7))
        : config.collections.find(({ slug }) => slug === source)
      expect(owner, `Missing translation target ${source}`).toBeDefined()
      missing.push(
        ...missingPaths(textPaths(config, owner!.fields), rule).map((path) => `${source}.${path}`),
      )
    }
    expect(missing, `Undeclared translation fields:\n${missing.join('\n')}`).toEqual([])
  })

  it('detects new fields and Blocks instead of automatically allowing them', async () => {
    const config = await configPromise
    const fields: Field[] = [
      { name: 'newTitle', type: 'text' },
      { name: 'group', type: 'group', fields: [{ name: 'newCopy', type: 'textarea' }] },
      {
        name: 'layout',
        type: 'blocks',
        blocks: [{ slug: 'newBlock', fields: [{ name: 'heading', type: 'text' }] }],
      },
    ]
    expect(missingPaths(textPaths(config, fields), getTranslationRule('pages')!)).toEqual([
      'newTitle',
      'group.newCopy',
      'layout[blockType=newBlock].heading',
    ])
  })

  it('declares each target and explicitly protects IDs, URLs, slugs, specification values and notification emails', () => {
    expect(Object.keys(translationRules).sort()).toEqual(
      [
        'products',
        'product-categories',
        'blogs',
        'blog-categories',
        'posts',
        'categories',
        'case-studies',
        'pages',
        'forms',
        'media',
        'global:header',
        'global:footer',
        'global:site-settings',
        'global:settings',
      ].sort(),
    )
    expect(RULE_VERSION).toBeGreaterThan(0)
    expect(getTranslationRule('unknown')).toBeUndefined()
    expect(getTranslationRule('products')).toMatchObject({
      slug: 'exclude',
      categorySlug: 'exclude',
      'sections[].anchor': 'exclude',
      'specifications[].items[].value': 'exclude',
      'sections[].blocks[blockType=productMediaText].body': 'translate',
    })
    expect(getTranslationRule('forms')).toMatchObject({
      title: 'exclude',
      'emails[].subject': 'exclude',
      'emails[].message': 'exclude',
      'fields[blockType=select].options[].value': 'exclude',
      'fields[blockType=select].options[].label': 'translate',
    })
    expect(getTranslationRule('media')).toMatchObject({
      alt: 'translate',
      caption: 'translate',
      filename: 'exclude',
      url: 'exclude',
      mimeType: 'exclude',
    })
    expect(getTranslationRule('global:header')).toMatchObject({
      'menuCta.label': 'translate',
      'menuCta.url': 'exclude',
    })
    expect(getTranslationRule('blogs')).toMatchObject({
      'content[blockType=blogCta].heading': 'translate',
      'content[blockType=blogCta].id': 'exclude',
      'content[blockType=blogCta].links[].link.url': 'exclude',
    })
  })

  it('parses the explicit rule grammar without accepting index-based or wildcard row paths', () => {
    expect(parseRulePath('sections[].blocks[blockType=productMediaText].body')).toEqual([
      { field: 'sections', row: true },
      { field: 'blocks', row: true, blockType: 'productMediaText' },
      { field: 'body', row: false },
    ])
    expect(parseRulePath('hero.richText')).toEqual([
      { field: 'hero', row: false },
      { field: 'richText', row: false },
    ])
    for (const path of [
      'sections[0].label',
      'sections[*].label',
      'sections[id=a].label',
      'title..value',
      '__proto__.title',
    ]) {
      expect(() => parseRulePath(path)).toThrow('Invalid translation rule path')
    }
    for (const rule of Object.values(translationRules))
      for (const path of Object.keys(rule)) expect(() => parseRulePath(path)).not.toThrow()
  })
})
