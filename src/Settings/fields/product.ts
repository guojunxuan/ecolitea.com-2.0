import type { Tab } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

import { imageOnly } from '@/collections/mediaUploadPolicy'

import { trimText } from './validation'

export const productTab: Tab = {
  name: 'product',
  label: 'Product Listing',
  fields: [
    {
      type: 'collapsible',
      label: 'Listing SEO',
      admin: {
        initCollapsed: true,
        style: { marginTop: 0, marginBottom: 'var(--spacer-2-5)' },
      },
      fields: [
        {
          name: 'seo',
          label: false,
          type: 'group',
          admin: { hideGutter: true },
          fields: [
            OverviewField({
              titlePath: 'product.seo.title',
              descriptionPath: 'product.seo.description',
              imagePath: 'product.seo.image',
            }),
            MetaTitleField({
              hasGenerateFn: false,
              overrides: { hooks: { beforeValidate: [trimText] } },
            }),
            MetaDescriptionField({
              hasGenerateFn: false,
              overrides: { hooks: { beforeValidate: [trimText] } },
            }),
            MetaImageField({
              relationTo: 'media',
              hasGenerateFn: false,
              overrides: { filterOptions: imageOnly },
            }),
            PreviewField({
              hasGenerateFn: false,
              titlePath: 'product.seo.title',
              descriptionPath: 'product.seo.description',
            }),
          ],
        },
      ],
    },
  ],
}
