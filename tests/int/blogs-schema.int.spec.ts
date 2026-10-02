// @vitest-environment node
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { buildConfig, getPayload, type Payload, type Field } from 'payload'
import { defaultLexical } from '@/fields/defaultLexical'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const flatten = (fields: Field[]): Field[] =>
  fields.flatMap((field) => [
    field,
    ...('fields' in field ? flatten(field.fields) : []),
    ...('tabs' in field ? field.tabs.flatMap((tab) => flatten(tab.fields)) : []),
  ])

describe('Blog collection configuration', () => {
  it('registers ordered categories, the category join, listing projections, and version settings', async () => {
    const config = await (await import('@/payload.config')).default
    const blogs = config.collections.find(({ slug }) => slug === 'blogs')
    const categories = config.collections.find(({ slug }) => slug === 'blog-categories')
    expect(blogs).toBeDefined()
    expect(categories).toMatchObject({ orderable: true, admin: { group: 'Blog' } })
    expect(categories?.fields).toContainEqual(
      expect.objectContaining({ name: 'blogs', type: 'join', collection: 'blogs', on: 'category' }),
    )
    expect(blogs?.defaultPopulate).toEqual({
      title: true,
      slug: true,
      category: true,
      heroImage: true,
      excerpt: true,
      publishedAt: true,
    })
    expect(blogs?.versions).toMatchObject({
      drafts: { autosave: { interval: 100 }, schedulePublish: true },
      maxPerDoc: 50,
    })
    const fields = flatten(blogs!.fields)
    const projectedAuthors = fields.find(
      (field) => 'name' in field && field.name === 'populatedAuthors',
    )!
    if (!('access' in projectedAuthors)) throw new Error('Missing populatedAuthors access config')
    expect(projectedAuthors.admin).toMatchObject({ disabled: true, readOnly: true })
    expect(projectedAuthors.access?.create?.({} as never)).toBe(false)
    expect(projectedAuthors.access?.update?.({} as never)).toBe(false)
    expect(fields.find((field) => 'name' in field && field.name === 'relatedBlogs')).toMatchObject({
      maxRows: 3,
      hasMany: true,
    })
  }, 20_000)
})

describe('Blogs through the isolated Payload Local API', () => {
  let payload: Payload
  let categoryID: string
  let mediaID: string
  let user: Awaited<ReturnType<Payload['create']>>
  const context = { disableRevalidate: true }
  const createBlog = (data: Record<string, unknown> = {}) =>
    payload.create({
      collection: 'blogs',
      context,
      user: user as never,
      data: {
        title: 'Test blog',
        slug: `blog-${randomUUID()}`,
        category: categoryID,
        heroImage: mediaID,
        excerpt: 'Test excerpt',
        content: [{ blockType: 'cta', heading: 'Test heading' }],
        _status: 'published',
        ...data,
      } as never,
    })

  beforeAll(async () => {
    const root = await (await import('@/payload.config')).default
    expect(root.collections.some(({ slug }) => slug === 'blogs')).toBe(true)
    const { Blogs } = await import('@/collections/Blogs')
    const { BlogCategories } = await import('@/collections/BlogCategories')
    const { Users } = await import('@/collections/Users')
    const databaseName = `ecolitea2-blogs-schema-${randomUUID()}`
    const url = `mongodb://127.0.0.1:27017/${databaseName}`
    console.info(
      `Blogs schema target: ${url}; DISABLE_R2_STORAGE=${process.env.DISABLE_R2_STORAGE}; no storage plugins, local uploads disabled`,
    )
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const config = await buildConfig({
      typescript: { autoGenerate: false },
      editor: defaultLexical,
      collections: [
        Blogs,
        BlogCategories,
        Users,
        ...(['pages', 'posts', 'case-studies', 'categories', 'forms'] as const).map((slug) => ({
          slug,
          fields: [{ name: 'title', type: 'text' as const }],
        })),
        {
          slug: 'media',
          upload: { disableLocalStorage: true, filesRequiredOnCreate: false },
          fields: [{ name: 'alt', type: 'text' }],
        },
      ],
      db: mongooseAdapter({ url, connectOptions: { serverSelectionTimeoutMS: 3_000 } }),
      secret: 'isolated-blogs-schema-test-secret-32-characters',
    })
    // Payload skips already-sanitized root blocks when buildConfig runs again.
    // Reuse the resolved registry after building the isolated collection config.
    config.blocks = root.blocks
    payload = await getPayload({ config, key: databaseName })
    categoryID = (
      await payload.create({
        collection: 'blog-categories',
        context,
        data: { title: 'Tea', slug: 'tea' },
      })
    ).id
    mediaID = (
      await payload.create({
        collection: 'media',
        data: { alt: 'Test hero', mimeType: 'image/png' },
      })
    ).id
    user = await payload.create({
      collection: 'users',
      data: {
        email: 'blog-author@example.test',
        password: 'isolated-test-password',
        name: 'Test Author',
      },
    })
  }, 25_000)

  afterAll(async () => {
    if (payload) {
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
  })

  it('creates, updates, joins, and deletes categories', async () => {
    const category = await payload.create({
      collection: 'blog-categories',
      context,
      data: { title: 'Disposable', slug: 'disposable' },
    })
    expect(category._order).toBeTruthy()
    await expect(
      payload.update({
        collection: 'blog-categories',
        context,
        id: category.id,
        data: { title: 'Renamed' },
      }),
    ).resolves.toMatchObject({ title: 'Renamed' })
    const blog = await createBlog()
    const joined = await payload.findByID({
      collection: 'blog-categories',
      id: categoryID,
      depth: 0,
    })
    expect(joined.blogs?.docs).toContain(blog.id)
    await payload.delete({ collection: 'blog-categories', context, id: category.id })
    await expect(
      payload.findByID({ collection: 'blog-categories', id: category.id }),
    ).rejects.toThrow()
  })

  it.each(['heroImage', 'excerpt', 'category', 'content'])(
    'rejects missing %s on publication',
    async (field) => {
      await expect(createBlog({ [field]: null })).rejects.toMatchObject({
        data: { errors: expect.arrayContaining([expect.objectContaining({ path: field })]) },
      })
    },
  )

  it('rejects empty content, long excerpts, and reserved slugs', async () => {
    for (const [field, value] of [
      ['content', []],
      ['excerpt', 'a'.repeat(161)],
      ['slug', 'category'],
      ['slug', 'page'],
    ] as const) {
      await expect(createBlog({ [field]: value })).rejects.toMatchObject({
        data: { errors: expect.arrayContaining([expect.objectContaining({ path: field })]) },
      })
    }
  })

  it('defaults the author, projects public author fields, and dates first publication only', async () => {
    const draft = await createBlog({ _status: 'draft' })
    expect(draft.publishedAt).toBeFalsy()
    expect(draft.content).toEqual([
      expect.objectContaining({ blockType: 'cta', heading: 'Test heading' }),
    ])
    await expect(
      payload.findByID({ collection: 'blogs', id: draft.id, overrideAccess: false }),
    ).rejects.toThrow()
    const storedDraft = await payload.findByID({
      collection: 'blogs',
      id: draft.id,
      depth: 0,
      draft: true,
    })
    expect(storedDraft.content).toEqual(draft.content)
    expect(
      draft.authors?.map((author) => (typeof author === 'object' ? author.id : author)),
    ).toEqual([user.id])
    const published = await payload.update({
      collection: 'blogs',
      id: draft.id,
      context,
      data: { _status: 'published' },
    })
    expect(published.category).toMatchObject({ id: categoryID })
    expect(published.content).toEqual(draft.content)
    expect(published.publishedAt).toBeTruthy()
    expect(published.populatedAuthors).toEqual([{ id: user.id, name: 'Test Author' }])
    const updated = await payload.update({
      collection: 'blogs',
      id: draft.id,
      context,
      data: { excerpt: 'Updated' },
    })
    expect(updated.publishedAt).toBe(published.publishedAt)
    const publicDoc = await payload.findByID({
      collection: 'blogs',
      id: draft.id,
      overrideAccess: false,
    })
    expect(publicDoc.populatedAuthors).toEqual([{ id: user.id, name: 'Test Author' }])
    expect(JSON.stringify(publicDoc)).not.toContain('blog-author@example.test')
  })

  it('limits related blogs to three and rejects self selection', async () => {
    const related = await Promise.all(Array.from({ length: 4 }, () => createBlog()))
    await expect(createBlog({ relatedBlogs: related.map(({ id }) => id) })).rejects.toMatchObject({
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'relatedBlogs' })]) },
    })
    await expect(
      payload.update({
        collection: 'blogs',
        context,
        id: related[0].id,
        data: { relatedBlogs: [related[0].id] },
      }),
    ).rejects.toMatchObject({
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'relatedBlogs' })]) },
    })
    await expect(
      createBlog({ relatedBlogs: related.slice(0, 3).map(({ id }) => id) }),
    ).resolves.toBeDefined()
  })
})
