import type { ClientField, Field } from 'payload'
import { BasePayload, createLocalReq } from 'payload'
import { createClientConfig } from 'payload/shared'
import { describe, expect, it } from 'vitest'

const productSlugs = [
  'productMediaBanner',
  'productMediaCarousel',
  'productMediaTabs',
  'productMediaAccordion',
  'productMediaText',
  'productCode',
]

function* fields(items: (Field | ClientField)[]): Generator<Field | ClientField> {
  for (const field of items) {
    yield field
    if ('fields' in field) yield* fields(field.fields)
    if (field.type === 'tabs') for (const tab of field.tabs) yield* fields(tab.fields)
  }
}

describe('Products sanitized Admin client config', () => {
  it('converts the real application config and retains all six nested block schemas', async () => {
    const config = await (await import('@/payload.config')).default
    // Public request construction initializes real translations without connecting to MongoDB.
    const payload = new BasePayload()
    payload.config = config
    const req = await createLocalReq({}, payload)
    const client = createClientConfig({ config, i18n: req.i18n, importMap: {}, user: true })
    const product = config.collections.find(({ slug }) => slug === 'products')!
    const clientProduct = client.collections.find(({ slug }) => slug === 'products')!
    const serverSections = [...fields(product.fields)].find(
      (field) => 'name' in field && field.name === 'sections',
    )!
    const clientSections = [...fields(clientProduct.fields)].find(
      (field) => 'name' in field && field.name === 'sections',
    )!
    expect(serverSections.type).toBe('array')
    expect(clientSections.type).toBe('array')
    if (serverSections.type !== 'array' || clientSections.type !== 'array')
      throw new Error('Missing sections array')
    expect([...fields(clientSections.fields)]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'theme', type: 'select', required: true }),
        expect.objectContaining({ name: 'title', type: 'text' }),
        expect.objectContaining({ name: 'description', type: 'textarea' }),
        expect.objectContaining({ name: 'anchor', type: 'text' }),
      ]),
    )
    expect(clientSections.fields).toContainEqual(
      expect.objectContaining({
        type: 'collapsible',
        label: 'Advanced',
        admin: expect.objectContaining({ initCollapsed: true }),
        fields: [expect.objectContaining({ name: 'anchor', type: 'text' })],
      }),
    )
    const serverBlocks = serverSections.fields.find(
      (field) => 'name' in field && field.name === 'blocks',
    )!
    const clientBlocks = clientSections.fields.find(
      (field) => 'name' in field && field.name === 'blocks',
    )!
    if (serverBlocks.type !== 'blocks' || clientBlocks.type !== 'blocks')
      throw new Error('Missing sections blocks')
    expect(
      serverBlocks.blocks.map((block) => (typeof block === 'string' ? block : block.slug)),
    ).toEqual(productSlugs)
    const schemas = clientBlocks.blocks.map((block) => {
      if (typeof block !== 'string') return block
      const resolved = client.blocks.find(({ slug }) => slug === block)
      if (!resolved) throw new Error(`Missing client block schema: ${block}`)
      return resolved
    })
    expect(schemas.map((block) => block.slug)).toEqual(productSlugs)
    for (const [index, block] of schemas.entries()) {
      const server = serverBlocks.blocks[index]
      if (typeof server === 'string') throw new Error('Expected collection-owned block config')
      expect(block.admin).toMatchObject({ group: 'Products', disableBlockName: true })
      expect(block.labels).toEqual(server.labels)
      expect(block.fields.map((field) => ('name' in field ? field.name : field.type))).toEqual(
        server.fields.map((field) => ('name' in field ? field.name : field.type)),
      )
      for (const field of fields(server.fields)) {
        if (field.type === 'richText' && 'editor' in field) {
          expect(typeof field.editor).toBe('object')
          expect(field.editor).toBeTruthy()
        }
      }
      for (const field of fields(block.fields)) {
        if ('name' in field) expect(['eyebrow', 'theme', 'defaultMedia']).not.toContain(field.name)
        expect(field).not.toHaveProperty('hooks')
        expect(field).not.toHaveProperty('validate')
        expect(field).not.toHaveProperty('admin.condition')
        if (field.type === 'richText') expect(field).not.toHaveProperty('editor')
      }
    }
    const code = schemas.find(({ slug }) => slug === 'productCode')!
    expect(
      code.fields
        .filter((field) => field.type === 'code')
        .map((field) => ({ name: field.name, language: field.admin?.language })),
    ).toEqual([
      { name: 'html', language: 'html' },
      { name: 'css', language: 'css' },
      { name: 'js', language: 'javascript' },
    ])
    for (const [slug, name, minRows, maxRows] of [
      ['productMediaCarousel', 'slides', 2, 12],
      ['productMediaTabs', 'tabs', 2, 6],
      ['productMediaAccordion', 'items', 2, 6],
    ] as const) {
      expect(
        schemas
          .find((block) => block.slug === slug)
          ?.fields.find((field) => 'name' in field && field.name === name),
      ).toMatchObject({
        type: 'array',
        minRows,
        maxRows,
        admin: { initCollapsed: true },
        fields: expect.arrayContaining([
          expect.objectContaining({ name: 'media', type: 'upload', relationTo: 'media' }),
        ]),
      })
    }
  }, 15000)
})
