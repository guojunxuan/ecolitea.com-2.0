// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { searchPlugin } from '@payloadcms/plugin-search'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { publicSearchVisibility } from '@/search/visibility'
import { propagateCategorySlug } from '@/collections/Products/hooks/propagateCategorySlug'
import { redirectsPlugin } from '@payloadcms/plugin-redirects'
import { buildConfig, createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { ProductCategories } from '@/collections/ProductCategories'
import { Products } from '@/collections/Products'
import { Users } from '@/collections/Users'
import { defaultLexical } from '@/fields/defaultLexical'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

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
      plugins: [searchPlugin({
        collections: ['products'],
        beforeSync: beforeSyncWithSearch,
        searchOverrides: {
          access: { read: () => publicSearchVisibility(new Date()) },
          fields: ({ defaultFields }) => [...defaultFields, ...searchFields],
        },
      }), redirectsPlugin({
        collections: ['products', 'product-categories'],
        redirectTypes: ['301'],
        redirectTypeFieldOverride: { defaultValue: '301', required: false },
      })],
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
    expect((await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).categorySlug).toBe('green-tea')

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

  it('allows anonymous reads only for published products whose publication date has arrived', async () => {
    const ids: string[] = []
    for (const state of ['public', 'draft', 'future'] as const) {
      const product = await payload.create({ collection: 'products', data: {
        title: state, slug: `${state}-${randomUUID()}`, category: secondCategoryID,
        gallery: [mediaID], excerpt: state,
        _status: state === 'draft' ? 'draft' : 'published',
        publishedAt: state === 'future' ? '2099-01-01T00:00:00.000Z' : '2020-01-01T00:00:00.000Z',
      } })
      ids.push(product.id)
    }
    const result = await payload.find({ collection: 'products', overrideAccess: false,
      depth: 0, where: { id: { in: ids } } })
    expect(result.docs.map(({ id }) => id)).toEqual([ids[0]])
    for (const id of ids.slice(1)) {
      await expect(payload.findByID({ collection: 'products', id, overrideAccess: false })).rejects.toThrow()
    }
  }, 20_000)

  it('rejects invalid product fields and the reserved product slug on real writes', async () => {
    const valid = { title: 'Validation', category: secondCategoryID, gallery: [mediaID], excerpt: 'Valid', _status: 'published' as const }
    for (const invalid of [{ gallery: [] }, { excerpt: 'x'.repeat(161) }, { slug: 'page' }, { category: null }]) {
      await expect(payload.create({ collection: 'products', data: {
        ...valid, slug: `validation-${randomUUID()}`, ...invalid,
      } as never })).rejects.toThrow()
    }
  }, 20_000)

  it('renames a category across a published product and its unpublished draft without publishing edits', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Published title', slug: `tea-${randomUUID()}`, category: firstCategoryID,
        gallery: [mediaID], excerpt: 'Public excerpt', _status: 'published',
      },
    })
    await payload.update({
      collection: 'products', id: product.id, draft: true,
      data: { title: 'Unpublished title', excerpt: 'Private draft excerpt' },
    })
    const beforeDraft = await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 })
    expect(beforeDraft.title).toBe('Unpublished title')
    const beforePublic = await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 })
    expect(beforePublic).toMatchObject({ title: 'Published title', _status: 'published' })

    await payload.update({
      collection: 'product-categories', id: firstCategoryID,
      data: { slug: 'green-tea-renamed' },
    })
    const published = await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 })
    const draft = await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 })
    expect(published).toMatchObject({ title: 'Published title', categorySlug: 'green-tea-renamed', _status: 'published' })
    expect(draft).toMatchObject({ title: 'Unpublished title', excerpt: 'Private draft excerpt', categorySlug: 'green-tea-renamed', _status: 'draft' })
    const redirect = await payload.find({ collection: 'redirects', where: { from: { equals: `/products/green-tea/${product.slug}` } }, depth: 0 })
    expect(redirect.docs[0]).toMatchObject({ type: '301', to: { type: 'reference', reference: { relationTo: 'products', value: product.id } } })
  }, 20_000)

  it('redirects and invalidates the old live URL when publishing a draft with a new slug and category', async () => {
    const product = await payload.create({ collection: 'products', data: {
      title: 'Live version', slug: `live-${randomUUID()}`, category: firstCategoryID,
      gallery: [mediaID], excerpt: 'Live', _status: 'published',
    } })
    const oldPath = `/products/${product.categorySlug}/${product.slug}`
    const draftSlug = `draft-${randomUUID()}`
    vi.clearAllMocks()
    await payload.update({ collection: 'products', id: product.id, draft: true,
      data: { slug: draftSlug, category: secondCategoryID, title: 'Draft version' },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect((await payload.find({ collection: 'redirects', where: { from: { equals: oldPath } } })).docs).toHaveLength(0)
    vi.clearAllMocks()
    await payload.update({ collection: 'products', id: product.id, data: { _status: 'published' } })
    const redirect = await payload.find({ collection: 'redirects', where: { from: { equals: oldPath } }, depth: 0 })
    expect(redirect.docs[0]).toMatchObject({ type: '301', to: { reference: { relationTo: 'products', value: product.id } } })
    expect(revalidatePath).toHaveBeenCalledWith(oldPath)
    expect(revalidatePath).toHaveBeenCalledWith(`/products/black-tea/${draftSlug}`)
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${firstCategoryID}`, 'max')
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${secondCategoryID}`, 'max')
  }, 20_000)

  it('renames only matching published and draft categories when a product has diverged versions', async () => {
    const publicCategory = await payload.create({ collection: 'product-categories', data: { title: 'Public C', slug: `public-${randomUUID()}`, image: mediaID } })
    const draftCategory = await payload.create({ collection: 'product-categories', data: { title: 'Draft D', slug: `draft-${randomUUID()}`, image: mediaID } })
    const product = await payload.create({ collection: 'products', data: {
      title: 'Public product', slug: `split-${randomUUID()}`, category: publicCategory.id,
      gallery: [mediaID], excerpt: 'Live', _status: 'published',
    } })
    await payload.update({ collection: 'products', id: product.id, draft: true,
      data: { category: draftCategory.id, title: 'Private product' },
    })
    const newPublicSlug = `${publicCategory.slug}-renamed`
    await payload.update({ collection: 'product-categories', id: publicCategory.id, data: { slug: newPublicSlug } })
    expect(await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 })).toMatchObject({ title: 'Public product', categorySlug: newPublicSlug, _status: 'published' })
    expect(await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 })).toMatchObject({ title: 'Private product', categorySlug: draftCategory.slug, _status: 'draft' })
    const liveRedirect = await payload.find({ collection: 'redirects', where: { from: { equals: `/products/${publicCategory.slug}/${product.slug}` } } })
    expect(liveRedirect.docs).toHaveLength(1)

    const newDraftSlug = `${draftCategory.slug}-renamed`
    await payload.update({ collection: 'product-categories', id: draftCategory.id, data: { slug: newDraftSlug } })
    expect(await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 })).toMatchObject({ title: 'Public product', categorySlug: newPublicSlug, _status: 'published' })
    expect(await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 })).toMatchObject({ title: 'Private product', categorySlug: newDraftSlug, _status: 'draft' })
    const draftRedirect = await payload.find({ collection: 'redirects', where: { from: { equals: `/products/${draftCategory.slug}/${product.slug}` } } })
    expect(draftRedirect.docs).toHaveLength(0)
  }, 20_000)

  it('invalidates the public URL when deleting a product whose latest version is a draft', async () => {
    const product = await payload.create({ collection: 'products', data: {
      title: 'To delete', slug: `delete-${randomUUID()}`, category: secondCategoryID,
      gallery: [mediaID], excerpt: 'Live', _status: 'published',
    } })
    const oldPath = `/products/${product.categorySlug}/${product.slug}`
    await payload.update({ collection: 'products', id: product.id, draft: true, data: { title: 'Draft only' } })
    vi.clearAllMocks()
    await payload.delete({ collection: 'products', id: product.id })
    expect(revalidatePath).toHaveBeenCalledWith(oldPath)
    expect(revalidateTag).toHaveBeenCalledWith(`product-${product.id}`, 'max')
  }, 20_000)
  it('restores the parent request context and invalidates the batch and category after nested Local API updates', async () => {
    const category = await payload.create({
      collection: 'product-categories',
      data: { title: 'Scoped', slug: `scope-${randomUUID()}`, image: mediaID },
    })
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Scoped Tea',
        slug: `scoped-${randomUUID()}`,
        category: category.id,
        gallery: [mediaID],
        excerpt: 'Scoped excerpt',
        _status: 'published',
      },
    })
    const originalContext = { taskMarker: 'parent', skipProductRedirect: false }
    const req = await createLocalReq({ context: originalContext }, payload)
    const updateSpy = vi.spyOn(payload, 'update')
    vi.clearAllMocks()
    const renamed = `${category.slug}-new`
    await payload.update({
      collection: 'product-categories',
      id: category.id,
      data: { slug: renamed },
      req,
    })
    expect(req.context).toStrictEqual(originalContext)
    expect(req.context).not.toHaveProperty('setDerivedCategorySlug')
    expect(req.context).not.toHaveProperty('disableRevalidate')
    expect(updateSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'products',
        req,
        context: expect.objectContaining({
          disableRevalidate: true,
          skipProductRedirect: true,
          setDerivedCategorySlug: true,
        }),
      }),
    )
    expect(revalidatePath).toHaveBeenCalledWith(`/products/${category.slug}/${product.slug}`)
    expect(revalidatePath).toHaveBeenCalledWith(`/products/${renamed}/${product.slug}`)
    expect(revalidateTag).toHaveBeenCalledWith('product-categories', 'max')
    expect(revalidateTag).toHaveBeenCalledWith(`product-${product.id}`, 'max')
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${category.id}`, 'max')
    const search = await payload.find({
      collection: 'search',
      depth: 0,
      where: { 'doc.value': { equals: product.id } },
    })
    expect(search.docs[0]).toMatchObject({
      categorySlug: renamed,
      excerpt: 'Scoped excerpt',
      heroImage: mediaID,
      category: { relationTo: 'product-categories', slug: renamed },
    })
    updateSpy.mockRestore()
  }, 20_000)

  it('restores the exact parent context when a nested write throws after createLocalReq mutates req', async () => {
    const category = await payload.create({
      collection: 'product-categories',
      data: { title: 'Error scope', slug: `error-${randomUUID()}`, image: mediaID },
    })
    await payload.create({
      collection: 'products',
      data: {
        title: 'Error Tea',
        slug: `error-tea-${randomUUID()}`,
        category: category.id,
        gallery: [mediaID],
        excerpt: 'Scoped error',
        _status: 'published',
      },
    })
    const originalContext = { taskMarker: 'error-parent', disableRevalidate: false }
    const req = await createLocalReq({ context: originalContext }, payload)
    const updateSpy = vi.spyOn(payload, 'update').mockImplementationOnce(async (options) => {
      await createLocalReq({ req, context: options.context }, payload)
      throw new Error('Injected nested write failure')
    })
    try {
      await expect(
        propagateCategorySlug({
          doc: { ...category, slug: `${category.slug}-new` },
          previousDoc: category,
          req,
        } as never),
      ).rejects.toThrow('Injected nested write failure')
      expect(req.context).toStrictEqual(originalContext)
      expect(req.context).toEqual({ taskMarker: 'error-parent', disableRevalidate: false })
    } finally {
      updateSpy.mockRestore()
    }
  }, 20_000)
})
