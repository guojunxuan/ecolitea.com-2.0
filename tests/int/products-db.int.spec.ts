// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { searchPlugin } from '@payloadcms/plugin-search'
import { searchFields } from '@/search/fieldOverrides'
import { beforeSyncWithSearch } from '@/search/beforeSync'
import { publicSearchVisibility } from '@/search/visibility'
import { propagateCategorySlug } from '@/collections/ProductCategories/hooks/propagateCategorySlug'
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

  let databaseURL: string

  const testConfig = (url: string, products = Products) =>
    buildConfig({
      secret: 'isolated-products-test-secret-32-characters',
      editor: defaultLexical,
      typescript: { autoGenerate: false },
      db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3_000 } }),
      plugins: [
        searchPlugin({
          collections: ['products'],
          beforeSync: beforeSyncWithSearch,
          searchOverrides: {
            access: { read: () => publicSearchVisibility(new Date()) },
            fields: ({ defaultFields }) => [...defaultFields, ...searchFields],
          },
        }),
        redirectsPlugin({
          collections: ['products', 'product-categories'],
        }),
      ],
      collections: [
        products,
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

  beforeAll(async () => {
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const databaseName = `ecolitea2-products-int-${randomUUID()}`
    const url = createIsolatedTestDatabaseURI(databaseName)
    databaseURL = url
    process.stdout.write(`Products DB test target: ${url}; storage: local disabled, R2 disabled\n`)
    const config = await testConfig(url)
    payload = await getPayload({ config, key: databaseName })
    const adapter = payload.db as MongooseAdapter
    process.stdout.write(
      `Products DB transaction capability: transactionOptions=${JSON.stringify(adapter.transactionOptions)}; replicaSet=${adapter.connection.getClient().options.replicaSet ?? 'none'}; rollback test skipped when disabled.\n`,
    )
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
        data: { title: 'Green Tea', slug: 'green-tea', image: mediaID, meta: { image: mediaID } },
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

  it('saves anchored empty sections, validates native limits and preserves partial row data', async () => {
    const base = {
      title: 'Sections validation',
      slug: `sections-${randomUUID()}`,
      category: firstCategoryID,
      gallery: [mediaID],
      summary: 'Sections',
      _status: 'published' as const,
    }
    const product = await payload.create({
      collection: 'products',
      depth: 0,
      data: {
        ...base,
        sections: [
          { label: 'Tea & Materials 中文', blocks: [] },
          { label: 'Custom', anchor: 'chosen-anchor' },
        ],
      },
    })
    expect(product.sections?.map((row) => row.anchor)).toEqual(['tea-materials', 'chosen-anchor'])
    const update = (data: unknown, draft = false) =>
      payload.update({
        collection: 'products',
        id: product.id,
        depth: 0,
        data: data as never,
        draft,
      })
    const invalid = async (sections: unknown, path: string) => {
      try {
        await update({ sections })
        expect.fail('Expected validation error')
      } catch (error) {
        expect(error).toBeInstanceOf((await import('payload')).ValidationError)
        expect((error as import('payload').ValidationError).data?.errors).toContainEqual(
          expect.objectContaining({ path }),
        )
      }
    }
    const renamed = await update({
      sections: [
        { id: product.sections![0].id, label: 'New label' },
        { id: product.sections![1].id, label: 'New custom label' },
      ],
    })
    expect(renamed.sections?.map((row) => row.anchor)).toEqual(['tea-materials', 'chosen-anchor'])
    expect((await update({ title: 'Other field' })).sections).toEqual(renamed.sections)
    const regenerated = await update({ sections: [{ id: renamed.sections![1].id, anchor: '' }] })
    expect(regenerated.sections?.[0]).toMatchObject({
      label: 'New custom label',
      anchor: 'new-custom-label',
    })
    await invalid([{ label: 'Same' }, { label: 'Same' }], 'sections.1.anchor')
    for (const anchor of [
      'overview',
      'options',
      'specifications',
      'related-products',
      'inquiry',
      '9-start',
      'bad space',
    ])
      await invalid([{ label: 'Label', anchor }], 'sections.0.anchor')
    await invalid([{ label: '中文!!!' }], 'sections.0.anchor')
    await invalid([{ label: '9 start' }], 'sections.0.anchor')
    await invalid([{ label: '', anchor: 'valid' }], 'sections.0.label')
    await invalid([{ label: 'L'.repeat(41), anchor: 'valid' }], 'sections.0.label')
    const rows = Array.from({ length: 8 }, (_, index) => ({
      label: `Section ${index}`,
      blocks: [],
    }))
    expect((await update({ sections: rows })).sections).toHaveLength(8)
    await invalid([...rows, { label: 'Ninth' }], 'sections')
    const draft = await update(
      { _status: 'draft', sections: [{ label: '', anchor: 'overview' }] },
      true,
    )
    expect(draft.sections?.[0].anchor).toBe('overview')
    try {
      await update({ _status: 'published' })
      expect.fail('Expected validation error')
    } catch (error) {
      expect(error).toBeInstanceOf((await import('payload')).ValidationError)
    }
    await update({ _status: 'published', sections: [{ label: 'Empty section', blocks: [] }] })
    const { toProductDetail } = await import('@/utilities/products/shared')
    expect(
      toProductDetail(await payload.findByID({ collection: 'products', id: product.id })).sections,
    ).toEqual([])
    await payload.delete({ collection: 'products', id: product.id })
  })

  it('validates options with native draft semantics, preserves inactive fields and populates detail media', async () => {
    const base = {
      title: 'Options validation',
      slug: `options-${randomUUID()}`,
      category: firstCategoryID,
      gallery: [mediaID],
      summary: 'Options',
      _status: 'published' as const,
    }
    const valid = [
      {
        name: 'Color',
        display: 'swatch' as const,
        values: [
          {
            label: 'Natural',
            swatch: '#AbC',
            thumbnail: mediaID,
            gallery: [mediaID],
            specifications: [{ label: 'Origin', value: 'India' }],
          },
        ],
      },
    ]
    const created = await payload.create({
      collection: 'products',
      data: { ...base, options: valid },
      depth: 0,
    })
    const update = (data: unknown, draft = false) =>
      payload.update({
        collection: 'products',
        id: created.id,
        data: data as never,
        draft,
        depth: 0,
      })
    const errors = async (data: unknown, path: string) => {
      try {
        await update(data)
        expect.fail('Expected validation error')
      } catch (error) {
        expect(error).toBeInstanceOf((await import('payload')).ValidationError)
        expect((error as import('payload').ValidationError).data?.errors).toEqual(
          expect.arrayContaining([expect.objectContaining({ path })]),
        )
      }
    }
    await errors({ options: [...valid, { ...valid[0], name: ' COLOR ' }] }, 'options.1.name')
    await errors({ options: [{ ...valid[0], name: 'N'.repeat(41) }] }, 'options.0.name')
    await errors(
      { options: [{ ...valid[0], values: [{ label: 'L'.repeat(41), swatch: '#abc' }] }] },
      'options.0.values.0.label',
    )
    await errors({ options: [{ ...valid[0], values: [] }] }, 'options.0.values')
    await errors({ options: [{ ...valid[0], values: null }] }, 'options.0.values')
    await errors(
      { options: [{ ...valid[0], values: [{ label: 'Natural', swatch: 'red' }] }] },
      'options.0.values.0.swatch',
    )
    await errors(
      { options: [{ ...valid[0], display: 'image', values: [{ label: 'Natural' }] }] },
      'options.0.values.0.thumbnail',
    )
    await errors({ options: [{ ...valid[0], display: 'unknown' }] }, 'options.0.display')
    const document = await payload.create({
      collection: 'media',
      data: { alt: 'Not an image', mimeType: 'application/pdf' },
    })
    await errors(
      {
        options: [
          { ...valid[0], display: 'image', values: [{ label: 'PDF', thumbnail: document.id }] },
        ],
      },
      'options.0.values.0.thumbnail',
    )
    await errors(
      {
        options: [
          { ...valid[0], display: 'text', values: [{ label: 'PDF', gallery: [document.id] }] },
        ],
      },
      'options.0.values.0.gallery',
    )
    const row = created.options![0]
    const text = await update({ options: [{ ...row, display: 'text' }] })
    expect(text.options![0].values[0]).toMatchObject({ swatch: '#AbC', thumbnail: mediaID })
    const image = await update({ options: [{ ...text.options![0], display: 'image' }] })
    expect(image.options![0].values[0]).toMatchObject({ swatch: '#AbC', thumbnail: mediaID })
    const partial = await update({ title: 'Unrelated partial update' })
    expect(partial.options![0].display).toBe('image')
    const rowPatch = await update({ options: [{ id: image.options![0].id, name: 'Colour' }] })
    expect(rowPatch.options![0].values[0]).toMatchObject({ swatch: '#AbC', thumbnail: mediaID })
    const valuePatch = await update({
      options: [
        {
          id: rowPatch.options![0].id,
          values: [{ id: rowPatch.options![0].values[0].id, label: 'Natural edited' }],
        },
      ],
    })
    expect(valuePatch.options![0].values[0]).toMatchObject({
      label: 'Natural edited',
      swatch: '#AbC',
      thumbnail: mediaID,
    })
    await errors(
      {
        options: [
          { ...image.options![0], values: [{ ...image.options![0].values[0], thumbnail: null }] },
        ],
      },
      'options.0.values.0.thumbnail',
    )
    const savedDraft = await update(
      {
        _status: 'draft',
        options: [{ name: 'Color', display: 'image', values: [{ label: 'Natural' }] }],
      },
      true,
    )
    expect(savedDraft._status).toBe('draft')
    await errors({ ...base, options: savedDraft.options }, 'options.0.values.0.thumbnail')
    // Restore a valid published document before testing the exact detail population contract.
    await update({ ...base, options: valid })
    const { productDetailPopulate } = await import('@/utilities/products/getProductBySlug')
    const populated = await payload.findByID({
      collection: 'products',
      id: created.id,
      depth: 2,
      populate: productDetailPopulate,
    })
    expect(populated.options![0].values[0].thumbnail).toMatchObject({
      id: mediaID,
      alt: 'Test image',
    })
    expect(populated.options![0].values[0].gallery![0]).toMatchObject({ id: mediaID })
    expect(populated.category).toMatchObject({
      image: { id: mediaID },
      meta: { image: { id: mediaID } },
    })
    const { toProductDetail } = await import('@/utilities/products/shared')
    expect(toProductDetail(populated).resolvedGallery[0]).toMatchObject({ id: mediaID })
    await payload.delete({ collection: 'products', id: created.id })
  })

  it('does no public product reads or redirects queries for native draft saves and autosaves', async () => {
    const product = await payload.create({
      collection: 'products',
      depth: 0,
      data: {
        title: 'Autosave live',
        slug: `autosave-${randomUUID()}`,
        category: secondCategoryID,
        gallery: [mediaID],
        summary: 'Live',
        _status: 'published',
      },
    })
    const findByID = vi.spyOn(payload, 'findByID')
    const find = vi.spyOn(payload, 'find')
    try {
      for (const autosave of [false, true]) {
        vi.clearAllMocks()
        await payload.update({
          collection: 'products',
          id: product.id,
          depth: 0,
          draft: true,
          autosave,
          data: { slug: `private-${randomUUID()}` },
        })
        expect(
          findByID.mock.calls.filter(
            ([args]) => args.collection === 'products' && args.draft === false,
          ),
        ).toHaveLength(0)
        expect(find.mock.calls.filter(([args]) => args.collection === 'redirects')).toHaveLength(0)
        expect(revalidatePath).not.toHaveBeenCalled()
        expect(revalidateTag).not.toHaveBeenCalled()
      }
    } finally {
      findByID.mockRestore()
      find.mockRestore()
    }
    expect(
      await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 }),
    ).toMatchObject({ slug: product.slug, _status: 'published' })
    const versions = await payload.findVersions({
      collection: 'products',
      where: { parent: { equals: product.id } },
    })
    expect(
      versions.docs.some(
        (version) =>
          'autosave' in version && version.autosave && version.version._status === 'draft',
      ),
    ).toBe(true)
  }, 20_000)

  it.each(['manual', 'scheduled'] as const)(
    'invalidates the stored public version on %s unpublish without touching redirects',
    async (mode) => {
      const product = await payload.create({
        collection: 'products',
        depth: 0,
        data: {
          title: 'Unpublish live',
          slug: `unpublish-${randomUUID()}`,
          category: firstCategoryID,
          gallery: [mediaID],
          summary: 'Live version',
          _status: 'published',
        },
      })
      await payload.update({
        collection: 'products',
        id: product.id,
        draft: true,
        data: { slug: `private-${randomUUID()}`, category: secondCategoryID },
      })
      const livePath = `/products/${product.categorySlug}/${product.slug}`
      const redirect = await payload.create({
        collection: 'redirects',
        data: { from: livePath, to: { type: 'custom', url: '/keep-this-redirect' } },
      })
      const job =
        mode === 'scheduled'
          ? await payload.jobs.queue({
              task: 'schedulePublish',
              input: { type: 'unpublish', doc: { relationTo: 'products', value: product.id } },
            })
          : null
      const findByID = vi.spyOn(payload, 'findByID')
      const find = vi.spyOn(payload, 'find')
      const create = vi.spyOn(payload, 'create')
      const update = vi.spyOn(payload, 'update')
      const remove = vi.spyOn(payload, 'delete')
      try {
        vi.clearAllMocks()
        if (job) {
          const result = await payload.jobs.runByID({ id: job.id })
          expect(result.jobStatus?.[job.id]).toEqual({ status: 'success' })
        } else {
          await payload.update({
            collection: 'products',
            id: product.id,
            data: { _status: 'draft' },
          })
        }
        expect(revalidatePath).toHaveBeenCalledWith(livePath)
        expect(revalidatePath).toHaveBeenCalledWith('/products/green-tea')
        for (const tag of [
          `product-${product.id}`,
          `product-category-${firstCategoryID}`,
          'products-list',
          'products-overview',
          'products-sitemap',
        ])
          expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
        expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
        expect(
          findByID.mock.calls.filter(
            ([args]) => args.collection === 'products' && args.draft === false,
          ),
        ).toHaveLength(2)
        for (const spy of [find, create, update, remove])
          expect(spy.mock.calls.filter(([args]) => args.collection === 'redirects')).toHaveLength(0)
      } finally {
        for (const spy of [findByID, find, create, update, remove]) spy.mockRestore()
      }
      expect(
        await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 }),
      ).toMatchObject({ _status: 'draft' })
      expect(
        await payload.findByID({ collection: 'redirects', id: redirect.id, depth: 0 }),
      ).toMatchObject({
        from: livePath,
        to: { type: 'custom', url: '/keep-this-redirect' },
      })
    },
    20_000,
  )

  it('publishes a changed draft through the native queued schedulePublish task', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Scheduled live',
        slug: `schedule-live-${randomUUID()}`,
        category: firstCategoryID,
        gallery: [mediaID],
        summary: 'Scheduled public product',
        _status: 'published',
      },
    })
    const slug = `schedule-next-${randomUUID()}`
    await payload.update({
      collection: 'products',
      id: product.id,
      draft: true,
      data: { slug, category: secondCategoryID },
    })
    const job = await payload.jobs.queue({
      task: 'schedulePublish',
      input: {
        type: 'publish',
        doc: { relationTo: 'products', value: product.id },
      },
    })
    vi.clearAllMocks()
    const result = await payload.jobs.runByID({ id: job.id })
    expect(result.jobStatus?.[job.id]).toEqual({ status: 'success' })
    expect(
      await payload.findByID({ collection: 'products', id: product.id, depth: 0, draft: false }),
    ).toMatchObject({ slug, categorySlug: 'black-tea', _status: 'published' })
    const oldPath = `/products/${product.categorySlug}/${product.slug}`
    expect(
      (
        await payload.find({
          collection: 'redirects',
          depth: 0,
          where: { from: { equals: oldPath } },
        })
      ).docs[0],
    ).toMatchObject({ to: { reference: { value: product.id } } })
    expect(revalidatePath).toHaveBeenCalledWith(oldPath)
    expect(revalidatePath).toHaveBeenCalledWith(`/products/black-tea/${slug}`)
    for (const tag of [
      'products-list',
      'products-sitemap',
      `product-${product.id}`,
      `product-category-${firstCategoryID}`,
      `product-category-${secondCategoryID}`,
    ])
      expect(revalidateTag).toHaveBeenCalledWith(tag, 'max')
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
  }, 20_000)

  it('rolls back a category rename and prior product/redirect writes when legacy required data fails validation', async (test) => {
    const adapter = payload.db as MongooseAdapter
    if (
      adapter.transactionOptions === false ||
      !adapter.connection.getClient().options.replicaSet
    ) {
      const reason = `Local MongoDB transactionOptions=${JSON.stringify(adapter.transactionOptions)}; replicaSet=${adapter.connection.getClient().options.replicaSet ?? 'none'}; category/product/redirect rollback cannot be verified.`
      process.stdout.write(`SKIP: ${reason}\n`)
      test.skip(reason)
    }
    // A previous Payload schema permits missing title. Every fixture write uses
    // the Local API; no raw Mongo writes bypass either schema or hooks.
    const legacyProducts = {
      ...Products,
      fields: Products.fields.map((field) =>
        'name' in field && field.name === 'title' ? { ...field, required: false } : field,
      ),
    }
    const legacy = await getPayload({
      config: await testConfig(databaseURL, legacyProducts),
      key: `products-legacy-${randomUUID()}`,
    })
    const req = await createLocalReq({ context: { taskMarker: 'legacy-rollback' } }, payload)
    try {
      const category = await payload.create({
        collection: 'product-categories',
        req,
        data: { title: 'Legacy category', slug: `legacy-${randomUUID()}`, image: mediaID },
      })
      const valid = await payload.create({
        collection: 'products',
        req,
        data: {
          title: 'Valid before legacy',
          slug: `valid-${randomUUID()}`,
          category: category.id,
          gallery: [mediaID],
          summary: 'Valid',
          _status: 'published',
        },
      })
      const invalid = await legacy.create({
        collection: 'products',
        req,
        data: {
          slug: `legacy-${randomUUID()}`,
          category: category.id,
          gallery: [mediaID],
          summary: 'Legacy missing title',
          _status: 'published',
        } as never,
      })
      const before = await Promise.all(
        [valid.id, invalid.id].map((id) =>
          payload.findByID({ collection: 'products', req, id, draft: false, depth: 0 }),
        ),
      )
      const redirectsBefore = await payload.find({
        collection: 'redirects',
        req,
        depth: 0,
        pagination: false,
      })
      const nestedReqs: unknown[] = []
      const update = payload.update.bind(payload)
      const spy = vi.spyOn(payload, 'update').mockImplementation((options) => {
        if (options.collection === 'products') nestedReqs.push(options.req)
        return update(options)
      })
      try {
        await expect(
          payload.update({
            collection: 'product-categories',
            id: category.id,
            req,
            data: { slug: `${category.slug}-new` },
          }),
        ).rejects.toMatchObject({ name: 'ValidationError' })
        expect(nestedReqs.length).toBeGreaterThanOrEqual(2)
        expect(nestedReqs.every((nested) => nested === req)).toBe(true)
      } finally {
        spy.mockRestore()
      }
      expect(
        await payload.findByID({
          collection: 'product-categories',
          id: category.id,
          req,
          depth: 0,
        }),
      ).toMatchObject({ slug: category.slug })
      expect(
        await Promise.all(
          [valid.id, invalid.id].map((id) =>
            payload.findByID({ collection: 'products', req, id, draft: false, depth: 0 }),
          ),
        ),
      ).toEqual(before)
      expect(
        (await payload.find({ collection: 'redirects', req, depth: 0, pagination: false })).docs,
      ).toEqual(redirectsBefore.docs)
      expect(req.context.taskMarker).toBe('legacy-rollback')
      expect(req.context.disableRevalidate).toBeUndefined()
    } finally {
      await legacy.destroy()
    }
  }, 25_000)

  it('protects published, draft-only and divergent category references without rewriting products', async () => {
    for (const state of ['published', 'draft', 'split'] as const) {
      const category = await payload.create({
        collection: 'product-categories',
        data: { title: `Delete ${state}`, slug: `delete-category-${randomUUID()}`, image: mediaID },
      })
      const other =
        state === 'split'
          ? await payload.create({
              collection: 'product-categories',
              data: {
                title: 'Draft destination',
                slug: `delete-other-${randomUUID()}`,
                image: mediaID,
              },
            })
          : null
      const product = await payload.create({
        collection: 'products',
        draft: state === 'draft',
        data: {
          title: `Reference ${state}`,
          slug: `reference-${randomUUID()}`,
          category: category.id,
          gallery: [mediaID],
          summary: 'Reference',
          _status: state === 'draft' ? 'draft' : 'published',
        },
      })
      if (other)
        await payload.update({
          collection: 'products',
          id: product.id,
          draft: true,
          data: { category: other.id, title: 'Private reference' },
        })
      const before = await Promise.all(
        [false, true].map((draft) =>
          payload.findByID({ collection: 'products', id: product.id, draft, depth: 0 }),
        ),
      )
      for (const target of [category, ...(other ? [other] : [])]) {
        await expect(
          payload.delete({ collection: 'product-categories', id: target.id }),
        ).rejects.toMatchObject({
          status: 400,
          message: expect.stringContaining('1 products still use it'),
        })
        expect(
          await payload.findByID({ collection: 'product-categories', id: target.id }),
        ).toMatchObject({ id: target.id })
      }
      const after = await Promise.all(
        [false, true].map((draft) =>
          payload.findByID({ collection: 'products', id: product.id, draft, depth: 0 }),
        ),
      )
      expect(after).toEqual(before)
    }
    const empty = await payload.create({
      collection: 'product-categories',
      data: { title: 'Empty', slug: `empty-${randomUUID()}`, image: mediaID },
    })
    expect(await payload.delete({ collection: 'product-categories', id: empty.id })).toMatchObject({
      id: empty.id,
    })
  }, 20_000)

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
        summary: 'Test product',
        _status: 'published',
      } as never,
    })
    expect(product.categorySlug).toBe('green-tea')
    expect(
      (await payload.findByID({ collection: 'products', id: product.id, depth: 0 })).categorySlug,
    ).toBe('green-tea')

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
      const product = await payload.create({
        collection: 'products',
        data: {
          title: state,
          slug: `${state}-${randomUUID()}`,
          category: secondCategoryID,
          gallery: [mediaID],
          summary: state,
          _status: state === 'draft' ? 'draft' : 'published',
          publishedAt: state === 'future' ? '2099-01-01T00:00:00.000Z' : '2020-01-01T00:00:00.000Z',
        },
      })
      ids.push(product.id)
    }
    const result = await payload.find({
      collection: 'products',
      overrideAccess: false,
      depth: 0,
      where: { id: { in: ids } },
    })
    expect(result.docs.map(({ id }) => id)).toEqual([ids[0]])
    for (const id of ids.slice(1)) {
      await expect(
        payload.findByID({ collection: 'products', id, overrideAccess: false }),
      ).rejects.toThrow()
    }
  }, 20_000)

  it('rejects invalid product fields and the reserved product slug on real writes', async () => {
    const valid = {
      title: 'Validation',
      category: secondCategoryID,
      gallery: [mediaID],
      summary: 'Valid',
      specifications: [{ group: 'General', label: 'Origin', value: 'China' }],
      _status: 'published' as const,
    }
    const saved = await payload.create({
      collection: 'products',
      data: { ...valid, slug: `renamed-fields-${randomUUID()}` },
    })
    expect(saved).toMatchObject({ summary: 'Valid', specifications: valid.specifications })
    expect(saved).not.toHaveProperty('excerpt')
    expect(saved).not.toHaveProperty('specs')
    for (const invalid of [
      { gallery: [] },
      { summary: '' },
      { specifications: [{ label: '', value: 'China' }] },
      { specifications: [{ label: 'Origin', value: '' }] },
      { summary: 'x'.repeat(161) },
      { slug: 'page' },
      { category: null },
    ]) {
      await expect(
        payload.create({
          collection: 'products',
          data: {
            ...valid,
            slug: `validation-${randomUUID()}`,
            ...invalid,
          } as never,
        }),
      ).rejects.toThrow()
    }
  }, 20_000)

  it('renames a category across a published product and its unpublished draft without publishing edits', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Published title',
        slug: `tea-${randomUUID()}`,
        category: firstCategoryID,
        gallery: [mediaID],
        summary: 'Public summary',
        _status: 'published',
      },
    })
    await payload.update({
      collection: 'products',
      id: product.id,
      draft: true,
      data: { title: 'Unpublished title', summary: 'Private draft summary' },
    })
    const beforeDraft = await payload.findByID({
      collection: 'products',
      id: product.id,
      draft: true,
      depth: 0,
    })
    expect(beforeDraft.title).toBe('Unpublished title')
    const beforePublic = await payload.findByID({
      collection: 'products',
      id: product.id,
      draft: false,
      depth: 0,
    })
    expect(beforePublic).toMatchObject({ title: 'Published title', _status: 'published' })

    await payload.update({
      collection: 'product-categories',
      id: firstCategoryID,
      data: { slug: 'green-tea-renamed' },
    })
    const published = await payload.findByID({
      collection: 'products',
      id: product.id,
      draft: false,
      depth: 0,
    })
    const draft = await payload.findByID({
      collection: 'products',
      id: product.id,
      draft: true,
      depth: 0,
    })
    expect(published).toMatchObject({
      title: 'Published title',
      categorySlug: 'green-tea-renamed',
      _status: 'published',
    })
    expect(draft).toMatchObject({
      title: 'Unpublished title',
      summary: 'Private draft summary',
      categorySlug: 'green-tea-renamed',
      _status: 'draft',
    })
    const redirect = await payload.find({
      collection: 'redirects',
      where: { from: { equals: `/products/green-tea/${product.slug}` } },
      depth: 0,
    })
    expect(redirect.docs[0]).toMatchObject({
      to: { type: 'reference', reference: { relationTo: 'products', value: product.id } },
    })
  }, 20_000)

  it('redirects and invalidates the old live URL when publishing a draft with a new slug and category', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Live version',
        slug: `live-${randomUUID()}`,
        category: firstCategoryID,
        gallery: [mediaID],
        summary: 'Live',
        _status: 'published',
      },
    })
    const oldPath = `/products/${product.categorySlug}/${product.slug}`
    const draftSlug = `draft-${randomUUID()}`
    vi.clearAllMocks()
    await payload.update({
      collection: 'products',
      id: product.id,
      draft: true,
      data: { slug: draftSlug, category: secondCategoryID, title: 'Draft version' },
    })
    expect(revalidatePath).not.toHaveBeenCalled()
    expect(
      (await payload.find({ collection: 'redirects', where: { from: { equals: oldPath } } })).docs,
    ).toHaveLength(0)
    vi.clearAllMocks()
    await payload.update({ collection: 'products', id: product.id, data: { _status: 'published' } })
    const redirect = await payload.find({
      collection: 'redirects',
      where: { from: { equals: oldPath } },
      depth: 0,
    })
    expect(redirect.docs[0]).toMatchObject({
      to: { reference: { relationTo: 'products', value: product.id } },
    })
    expect(revalidatePath).toHaveBeenCalledWith(oldPath)
    expect(revalidatePath).toHaveBeenCalledWith(`/products/black-tea/${draftSlug}`)
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${firstCategoryID}`, 'max')
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${secondCategoryID}`, 'max')
  }, 20_000)

  it('keeps each old public transition during native bulk publication of changed drafts', async () => {
    const products = []
    for (const index of [0, 1]) {
      const product = await payload.create({
        collection: 'products',
        data: {
          title: `Bulk live ${index}`,
          slug: `bulk-live-${randomUUID()}`,
          category: firstCategoryID,
          gallery: [mediaID],
          summary: 'Public bulk product',
          _status: 'published',
        },
      })
      const draftSlug = `bulk-draft-${randomUUID()}`
      await payload.update({
        collection: 'products',
        id: product.id,
        draft: true,
        data: { slug: draftSlug, category: secondCategoryID },
      })
      products.push({ ...product, draftSlug })
    }
    vi.clearAllMocks()
    const result = await payload.update({
      collection: 'products',
      where: { id: { in: products.map(({ id }) => id) } },
      draft: true,
      data: { _status: 'published' },
    })
    expect(result.errors).toEqual([])
    expect(result.docs).toHaveLength(2)
    for (const product of products) {
      const oldPath = `/products/${product.categorySlug}/${product.slug}`
      const redirect = await payload.find({
        collection: 'redirects',
        depth: 0,
        where: { from: { equals: oldPath } },
      })
      expect(redirect.docs[0]).toMatchObject({
        to: { reference: { relationTo: 'products', value: product.id } },
      })
      expect(revalidatePath).toHaveBeenCalledWith(oldPath)
      expect(revalidatePath).toHaveBeenCalledWith(`/products/black-tea/${product.draftSlug}`)
      expect(revalidatePath).toHaveBeenCalledWith(`/products/${product.categorySlug}`)
      expect(revalidateTag).toHaveBeenCalledWith(`product-${product.id}`, 'max')
    }
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${firstCategoryID}`, 'max')
    expect(revalidateTag).toHaveBeenCalledWith(`product-category-${secondCategoryID}`, 'max')
  }, 20_000)

  it('redirects the actual live URL when restoring a published version over a newer draft', async () => {
    const historical = await payload.create({
      collection: 'products',
      data: {
        title: 'Historical published',
        slug: `historical-${randomUUID()}`,
        category: secondCategoryID,
        gallery: [mediaID],
        summary: 'Historical public product',
        _status: 'published',
      },
    })
    const versions = await payload.findVersions({
      collection: 'products',
      depth: 0,
      where: {
        and: [
          { parent: { equals: historical.id } },
          { 'version.slug': { equals: historical.slug } },
        ],
      },
    })
    const historicalVersion = versions.docs.find(({ version }) => version._status === 'published')!
    expect(historicalVersion).toBeDefined()
    const current = await payload.update({
      collection: 'products',
      id: historical.id,
      data: { slug: `current-${randomUUID()}`, category: firstCategoryID },
    })
    await payload.update({
      collection: 'products',
      id: historical.id,
      draft: true,
      data: { slug: `private-${randomUUID()}`, title: 'Private draft' },
    })
    vi.clearAllMocks()
    const restored = await payload.restoreVersion({
      collection: 'products',
      id: historicalVersion.id,
    })
    expect(restored).toMatchObject({ slug: historical.slug, _status: 'published' })
    const oldPath = `/products/${current.categorySlug}/${current.slug}`
    const redirect = await payload.find({
      collection: 'redirects',
      depth: 0,
      where: { from: { equals: oldPath } },
    })
    expect(redirect.docs[0]).toMatchObject({
      to: { reference: { relationTo: 'products', value: historical.id } },
    })
    for (const path of [
      oldPath,
      `/products/black-tea/${historical.slug}`,
      `/products/${current.categorySlug}`,
    ]) {
      expect(revalidatePath).toHaveBeenCalledWith(path)
    }
    for (const categoryID of [firstCategoryID, secondCategoryID]) {
      expect(revalidateTag).toHaveBeenCalledWith(`product-category-${categoryID}`, 'max')
    }
    expect(revalidateTag).toHaveBeenCalledWith('redirects', { expire: 0 })
  }, 20_000)

  it('uses fresh public state when the same request is reused after suppressed writes and deletion', async () => {
    const req = await createLocalReq({ context: { taskMarker: 'sequential' } }, payload)
    const product = await payload.create({
      collection: 'products',
      req,
      data: {
        title: 'Reused request',
        slug: `reuse-${randomUUID()}`,
        category: firstCategoryID,
        gallery: [mediaID],
        summary: 'Reused public product',
        _status: 'published',
      },
    })
    const suppressedSlug = `suppressed-${randomUUID()}`
    await payload.update({
      collection: 'products',
      id: product.id,
      req,
      context: { disableRevalidate: true, skipProductRedirect: true },
      data: { slug: suppressedSlug },
    })
    const nextSlug = `next-${randomUUID()}`
    vi.clearAllMocks()
    await payload.update({
      collection: 'products',
      id: product.id,
      req,
      context: { disableRevalidate: false, skipProductRedirect: false },
      data: { slug: nextSlug },
    })
    const suppressedPath = `/products/${product.categorySlug}/${suppressedSlug}`
    expect(
      (
        await payload.find({
          collection: 'redirects',
          req,
          depth: 0,
          where: { from: { equals: suppressedPath } },
        })
      ).docs[0],
    ).toMatchObject({ to: { reference: { value: product.id } } })
    expect(revalidatePath).toHaveBeenCalledWith(suppressedPath)
    await payload.update({
      collection: 'products',
      id: product.id,
      req,
      draft: true,
      data: { slug: `reuse-draft-${randomUUID()}` },
    })
    vi.clearAllMocks()
    await payload.delete({ collection: 'products', id: product.id, req })
    expect(revalidatePath).toHaveBeenCalledWith(`/products/${product.categorySlug}/${nextSlug}`)
    expect(req.context.taskMarker).toBe('sequential')
  }, 20_000)

  it('renames only matching published and draft categories when a product has diverged versions', async () => {
    const publicCategory = await payload.create({
      collection: 'product-categories',
      data: { title: 'Public C', slug: `public-${randomUUID()}`, image: mediaID },
    })
    const draftCategory = await payload.create({
      collection: 'product-categories',
      data: { title: 'Draft D', slug: `draft-${randomUUID()}`, image: mediaID },
    })
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'Public product',
        slug: `split-${randomUUID()}`,
        category: publicCategory.id,
        gallery: [mediaID],
        summary: 'Live',
        _status: 'published',
      },
    })
    await payload.update({
      collection: 'products',
      id: product.id,
      draft: true,
      data: { category: draftCategory.id, title: 'Private product' },
    })
    const newPublicSlug = `${publicCategory.slug}-renamed`
    await payload.update({
      collection: 'product-categories',
      id: publicCategory.id,
      data: { slug: newPublicSlug },
    })
    expect(
      await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 }),
    ).toMatchObject({ title: 'Public product', categorySlug: newPublicSlug, _status: 'published' })
    expect(
      await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 }),
    ).toMatchObject({
      title: 'Private product',
      categorySlug: draftCategory.slug,
      _status: 'draft',
    })
    const liveRedirect = await payload.find({
      collection: 'redirects',
      where: { from: { equals: `/products/${publicCategory.slug}/${product.slug}` } },
    })
    expect(liveRedirect.docs).toHaveLength(1)

    const newDraftSlug = `${draftCategory.slug}-renamed`
    await payload.update({
      collection: 'product-categories',
      id: draftCategory.id,
      data: { slug: newDraftSlug },
    })
    expect(
      await payload.findByID({ collection: 'products', id: product.id, draft: false, depth: 0 }),
    ).toMatchObject({ title: 'Public product', categorySlug: newPublicSlug, _status: 'published' })
    expect(
      await payload.findByID({ collection: 'products', id: product.id, draft: true, depth: 0 }),
    ).toMatchObject({ title: 'Private product', categorySlug: newDraftSlug, _status: 'draft' })
    const draftRedirect = await payload.find({
      collection: 'redirects',
      where: { from: { equals: `/products/${draftCategory.slug}/${product.slug}` } },
    })
    expect(draftRedirect.docs).toHaveLength(0)
  }, 20_000)

  it('invalidates the public URL when deleting a product whose latest version is a draft', async () => {
    const product = await payload.create({
      collection: 'products',
      data: {
        title: 'To delete',
        slug: `delete-${randomUUID()}`,
        category: secondCategoryID,
        gallery: [mediaID],
        summary: 'Live',
        _status: 'published',
      },
    })
    const oldPath = `/products/${product.categorySlug}/${product.slug}`
    await payload.update({
      collection: 'products',
      id: product.id,
      draft: true,
      data: { title: 'Draft only' },
    })
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
        summary: 'Scoped summary',
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
      excerpt: 'Scoped summary',
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
        summary: 'Scoped error',
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
