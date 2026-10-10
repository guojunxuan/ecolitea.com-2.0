import type { Condition, Tab } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'

import { trimText, validateEnabledHeading } from './validation'

const whenEnabled: Condition = (_, siblingData) => siblingData?.enabled === true

export const blogTab: Tab = {
  name: 'blog',
  label: 'Blog',
  fields: [
    {
      name: 'listing',
      label: 'Listing page',
      type: 'group',
      fields: [
        {
          name: 'hero',
          label: 'Hero',
          type: 'group',
          fields: [
            {
              name: 'enabled',
              type: 'checkbox',
              defaultValue: false,
            },
            {
              name: 'heading',
              type: 'text',
              hooks: { beforeValidate: [trimText] },
              validate: validateEnabledHeading,
              admin: { condition: whenEnabled },
            },
            {
              name: 'description',
              type: 'textarea',
              hooks: { beforeValidate: [trimText] },
              admin: { condition: whenEnabled },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              filterOptions: { mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] } },
              admin: { condition: whenEnabled },
            },
            {
              name: 'headerTheme',
              type: 'select',
              required: true,
              defaultValue: 'light',
              options: [
                { label: 'Light', value: 'light' },
                { label: 'Dark', value: 'dark' },
              ],
              admin: {
                condition: whenEnabled,
                description:
                  'Use Dark for dark images (white text and header), Light for bright images or no image.',
              },
            },
          ],
        },
        {
          name: 'seo',
          label: 'SEO',
          type: 'group',
          fields: [
            OverviewField({
              titlePath: 'blog.listing.seo.title',
              descriptionPath: 'blog.listing.seo.description',
              imagePath: 'blog.listing.seo.image',
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
              overrides: {
                filterOptions: { mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] } },
              },
            }),
            PreviewField({
              hasGenerateFn: true,
              titlePath: 'blog.listing.seo.title',
              descriptionPath: 'blog.listing.seo.description',
            }),
          ],
        },
      ],
    },
  ],
}
