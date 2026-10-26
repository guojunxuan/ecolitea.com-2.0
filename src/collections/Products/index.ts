import type { CollectionConfig } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { authenticated } from '@/access/authenticated'
import { authenticatedOrPublishedProduct } from '@/access/authenticatedOrPublishedProduct'
import { imageOnly } from '@/collections/mediaUploadPolicy'
import { generatePreviewPath } from '@/utilities/generatePreviewPath'
import { productInquiry } from './fields/inquiry'
import { productSections } from './fields/sections'
import { generateSectionAnchors } from './hooks/validateSections'
import { productOptions } from './fields/options'
import { setProductCategorySlug } from './hooks/setProductCategorySlug'
import { redirectProduct } from './hooks/productRedirects'
import { revalidateProduct, revalidateProductDelete } from './hooks/revalidateProduct'
import {
  captureProductPublicBeforeDelete,
  captureProductPublicState,
  captureProductWriteIntent,
} from './hooks/productPublicTransition'

export const Products: CollectionConfig = {
  slug: 'products',
  labels: { singular: 'Product', plural: 'Products' },
  admin: {
    group: 'Product',
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'publishedAt', '_status'],
    livePreview: {
      url: ({ data, req }) =>
        generatePreviewPath({
          collection: 'products',
          slug: data?.slug,
          categorySlug: data?.categorySlug,
          req,
        }),
    },
    preview: (data, { req }) =>
      generatePreviewPath({
        collection: 'products',
        slug: data?.slug as string,
        categorySlug: data?.categorySlug as string | null,
        req,
      }),
  },
  access: {
    create: authenticated,
    read: authenticatedOrPublishedProduct,
    update: authenticated,
    delete: authenticated,
  },
  defaultPopulate: {
    title: true,
    slug: true,
    categorySlug: true,
    category: true,
    gallery: true,
    summary: true,
    publishedAt: true,
  },
  fields: [
    { name: 'title', type: 'text', required: true },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Overview',
          fields: [
            {
              name: 'gallery',
              type: 'upload',
              relationTo: 'media',
              hasMany: true,
              minRows: 1,
              required: true,
              filterOptions: imageOnly,
            },
            { name: 'summary', type: 'textarea', required: true, maxLength: 160 },
            {
              name: 'highlights',
              type: 'array',
              maxRows: 6,
              admin: {
                initCollapsed: true,
                components: {
                  RowLabel: '@/collections/Products/admin/HighlightRowLabel#HighlightRowLabel',
                },
              },
              fields: [{ name: 'text', type: 'text', required: true, maxLength: 120 }],
            },
            {
              name: 'specifications',
              type: 'array',
              admin: {
                initCollapsed: true,
                components: {
                  RowLabel:
                    '@/collections/Products/admin/SpecificationRowLabel#SpecificationRowLabel',
                },
              },
              fields: [
                { name: 'label', type: 'text', required: true },
                { name: 'value', type: 'text', required: true },
              ],
            },
            productInquiry,
          ],
        },
        { label: 'Options', fields: [productOptions] },
        {
          label: 'Details',
          fields: [productSections],
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
            MetaImageField({
              relationTo: 'media',
              hasGenerateFn: true,
              overrides: { filterOptions: imageOnly },
            }),
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
      validate: (value) => (value === 'page' ? 'Slug cannot be "page" (reserved word).' : true),
    },
    {
      name: 'category',
      type: 'relationship',
      relationTo: 'product-categories',
      required: true,
      admin: { position: 'sidebar', allowCreate: true },
    },
    {
      name: 'categorySlug',
      type: 'text',
      admin: { hidden: true },
      access: { update: () => false },
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
      name: 'relatedProducts',
      type: 'relationship',
      relationTo: 'products',
      hasMany: true,
      maxRows: 4,
      admin: { position: 'sidebar' },
      filterOptions: ({ id }) => (id ? { id: { not_in: [id] } } : true),
    },
  ],
  hooks: {
    beforeOperation: [captureProductWriteIntent],
    beforeValidate: [generateSectionAnchors],
    beforeChange: [captureProductPublicState, setProductCategorySlug],
    afterChange: [redirectProduct, revalidateProduct],
    beforeDelete: [captureProductPublicBeforeDelete],
    afterDelete: [revalidateProductDelete],
  },
  versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true }, maxPerDoc: 50 },
}
