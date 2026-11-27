import type { Tab } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

import { imageOnly } from '@/collections/mediaUploadPolicy'

import { productCategoryCarousel, productListingHero } from './productListing'
import { trimText } from './validation'

export const productTab: Tab = {
  name: 'product',
  label: 'Product',
  fields: [
    {
      type: 'group',
      label: 'Overview',
      admin: {
        description:
          'Hero slides, Category Carousel and search settings for the products overview page (/products).',
      },
      fields: [
        productListingHero(),
        productCategoryCarousel(),
        {
          type: 'collapsible',
          label: 'SEO',
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
    },
  ],
}
