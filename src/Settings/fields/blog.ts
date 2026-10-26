import type { Tab } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

import { imageOnly } from '@/collections/mediaUploadPolicy'

import { articleShareField } from './article'

import { listingHero } from './listingHero'
import { trimText } from './validation'

export const blogTab: Tab = {
  name: 'blog',
  label: 'Blog',
  fields: [
    listingHero(),
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
              titlePath: 'blog.seo.title',
              descriptionPath: 'blog.seo.description',
              imagePath: 'blog.seo.image',
            }),
            MetaTitleField({
              hasGenerateFn: true,
              overrides: { hooks: { beforeValidate: [trimText] } },
            }),
            MetaDescriptionField({
              hasGenerateFn: true,
              overrides: { hooks: { beforeValidate: [trimText] } },
            }),
            MetaImageField({
              relationTo: 'media',
              hasGenerateFn: true,
              overrides: {
                filterOptions: imageOnly,
              },
            }),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'blog.seo.title',
              descriptionPath: 'blog.seo.description',
            }),
          ],
        },
      ],
    },
    articleShareField,
  ],
}
