import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'
import { authenticated } from '@/access/authenticated'
import { anyone } from '@/access/anyone'
import { imageOnly } from '@/collections/mediaUploadPolicy'
import type { CollectionConfig } from 'payload'
import { propagateCategorySlug } from './hooks/propagateCategorySlug'
import {
  revalidateProductCategory,
  revalidateProductCategoryDelete,
} from './hooks/revalidateProductCategory'

import { preventReferencedDelete } from './hooks/preventReferencedDelete'

export const ProductCategories: CollectionConfig = {
  slug: 'product-categories',
  labels: { singular: 'Product Category', plural: 'Product Categories' },
  admin: { group: 'Product', useAsTitle: 'title', defaultColumns: ['title', 'slug'] },
  orderable: true,
  access: { read: anyone, create: authenticated, update: authenticated, delete: authenticated },
  fields: [
    {
      type: 'tabs',
      tabs: [
        {
          label: 'Content',
          fields: [
            { name: 'title', type: 'text', required: true },
            { name: 'description', type: 'textarea' },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              required: true,
              filterOptions: imageOnly,
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
    { name: 'slug', type: 'slug', useAsSlug: 'title', admin: { position: 'sidebar' } },
    { name: 'products', type: 'join', collection: 'products', on: 'category' },
  ],
  hooks: {
    beforeDelete: [preventReferencedDelete],
    afterChange: [propagateCategorySlug, revalidateProductCategory],
    afterDelete: [revalidateProductCategoryDelete],
  },
}
