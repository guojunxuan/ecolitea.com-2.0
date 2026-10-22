// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { buildConfig, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ProductCategories } from '@/collections/ProductCategories'
import { Products } from '@/collections/Products'
import { Users } from '@/collections/Users'
import { defaultLexical } from '@/fields/defaultLexical'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

describe('Products through isolated Payload Local API', () => {
  let payload: Payload
  let editor: Awaited<ReturnType<Payload['create']>>
  let mediaID: string
  let firstCategoryID: string
  let secondCategoryID: string

  beforeAll(async () => {
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const databaseName = `ecolitea2-products-int-${randomUUID()}`
    const url = createIsolatedTestDatabaseURI(databaseName)
    console.info(`Products DB test target: ${url}; storage: local disabled, R2 disabled`)
    const config = await buildConfig({
      secret: 'isolated-products-test-secret-32-characters',
      editor: defaultLexical,
      typescript: { autoGenerate: false },
      db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3_000 } }),
      collections: [
        Products,
        ProductCategories,
        Users,
        {
          slug: 'media',
          upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
          fields: [{ name: 'alt', type: 'text' }],
        },
        { slug: 'documents', fields: [{ name: 'title', type: 'text' }] },
        ...(['pages', 'posts', 'blogs', 'blog-categories', 'case-studies'] as const).map(
          (slug) => ({ slug, fields: [{ name: 'title', type: 'text' as const }] }),
        ),
      ],
    })
    payload = await getPayload({ config, key: databaseName })
    editor = await payload.create({
      collection: 'users',
      data: { email: 'products-editor@example.test', password: 'isolated-test-password' },
    })
    mediaID = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Test image', mimeType: 'image/png' },
      })
    ).id
    firstCategoryID = (
      await payload.create({
        collection: 'product-categories',
        data: { title: 'Green Tea', slug: 'green-tea', image: mediaID },
      })
    ).id
    secondCategoryID = (
      await payload.create({
        collection: 'product-categories',
        data: { title: 'Black Tea', slug: 'black-tea', image: mediaID },
      })
    ).id
  }, 25_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })

  it('persists the derived categorySlug across forged create, unchanged update, and category change', async () => {
    const product = await payload.create({
      collection: 'products',
      overrideAccess: false,
      user: editor as never,
      data: {
        title: 'Tea Product',
        slug: `tea-product-${randomUUID()}`,
        category: firstCategoryID,
        categorySlug: 'forged-create',
        gallery: [mediaID],
        excerpt: 'Test product',
        _status: 'published',
      } as never,
    })
    expect(product.categorySlug).toBe('green-tea')

    await payload.update({
      collection: 'products',
      id: product.id,
      overrideAccess: false,
      user: editor as never,
      data: { categorySlug: 'forged-update' } as never,
    })
    expect(
      (await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).categorySlug,
    ).toBe('green-tea')

    await payload.update({
      collection: 'products',
      id: product.id,
      overrideAccess: false,
      user: editor as never,
      data: { category: secondCategoryID, categorySlug: 'forged-change' } as never,
    })
    expect(
      (await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).categorySlug,
    ).toBe('black-tea')
  }, 15_000)
})
