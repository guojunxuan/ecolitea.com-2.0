import type { CollectionConfig } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublishedBlog } from '@/access/authenticatedOrPublishedBlog'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { populateAuthors } from './hooks/populateAuthors'
import { revalidateBlog, revalidateDelete } from './hooks/revalidateBlog'

export const Blogs: CollectionConfig = {
  slug: 'blogs',
  admin: {
    group: 'Blog',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', '_status'],
    livePreview: {
      url: ({ data, req }) => generatePreviewPath({ collection: 'blogs', slug: data?.slug, req }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({ collection: 'blogs', slug: data?.slug as string, req }),
  },
  access: {
    create: authenticated,
    read: authenticatedOrPublishedBlog,
    update: authenticated,
    delete: authenticated,
  },
  defaultPopulate: {
    title: true,
    slug: true,
    category: true,
    heroImage: true,
    excerpt: true,
    publishedAt: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            {
              name: 'heroImage',
              type: 'upload',
              relationTo: 'media',
              required: true,
              filterOptions: { mimeType: { contains: 'image/' } },
            },
            { name: 'excerpt', type: 'textarea', required: true, maxLength: 160 },
            {
              name: 'content',
              type: 'blocks',
              blocks: ['prose', 'mediaBlock', 'keyTakeaways', 'cta', 'banner'],
              minRows: 1,
              required: true,
            },
          ],
        },
        {
          name: 'meta',
          label: 'SEO',
          fields: [
            OverviewField({
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
              imagePath: 'meta.image',
            }),
            MetaTitleField({ hasGenerateFn: true }),
            MetaImageField({ relationTo: 'media', hasGenerateFn: true }),
            MetaDescriptionField({ hasGenerateFn: true }),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'meta.title',
              descriptionPath: 'meta.description',
            }),
          ],
        },
      ],
    },
    {
      name: 'slug',
      type: 'slug',
      useAsSlug: 'title',
      admin: { position: 'sidebar' },
      validate: (value) =>
        ['category', 'page'].includes(value || '')
          ? 'Slug cannot be "category" or "page" (reserved words).'
          : true,
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'blog-categories',
      required: true,
      admin: { position: 'sidebar', allowCreate: true },
    },
    {
      name: 'publishedAt',
      type: 'date',
      admin: { position: 'sidebar', date: { pickerAppearance: 'dayAndTime' } },
      hooks: {
        beforeChange: [
          ({ siblingData, value }) =>
            siblingData._status === 'published' && !value ? new Date() : value,
        ],
      },
    },
    {
      name: 'authors',
      type: 'relationship',
      relationTo: 'users',
      hasMany: true,
      admin: { position: 'sidebar' },
      defaultValue: ({ user }) => (user ? [user.id] : []),
    },
    {
      name: 'populatedAuthors',
      type: 'array',
      access: { create: () => false, update: () => false },
      admin: { disabled: true, readOnly: true },
      fields: [
        { name: 'id', type: 'text' },
        { name: 'name', type: 'text' },
      ],
    },
    {
      name: 'relatedBlogs',
      type: 'relationship',
      relationTo: 'blogs',
      hasMany: true,
      maxRows: 3,
      admin: { position: 'sidebar' },
      filterOptions: ({ id }) => (id ? { id: { not_in: [id] } } : true),
    },
  ],
  hooks: {
    afterChange: [revalidateBlog],
    afterRead: [populateAuthors],
    afterDelete: [revalidateDelete],
  },
  versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true }, maxPerDoc: 50 },
}
