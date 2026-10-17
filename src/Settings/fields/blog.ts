import type { Condition, Tab } from 'payload'
import {
  MetaDescriptionField,
  MetaImageField,
  MetaTitleField,
  OverviewField,
  PreviewField,
} from '@payloadcms/plugin-seo/fields'

import { imageOnly } from '@/collections/mediaUploadPolicy'

import { articleShareField } from './article'

import { trimText, validateEnabledHeading } from './validation'

const whenEnabled: Condition = (_, siblingData) => siblingData?.enabled === true

export const blogTab: Tab = {
  name: 'blog',
  label: 'Blog',
  fields: [
    {
      type: 'collapsible',
      label: 'Listing Hero',
      admin: {
        initCollapsed: false,
            style: { marginTop: 0, marginBottom: 'var(--spacer-2-5)' },
      },
      fields: [
        {
          name: 'hero',
          label: false,
          type: 'group',
          admin: { hideGutter: true },
          fields: [
            { name: 'enabled', type: 'checkbox', defaultValue: false },
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
              filterOptions: imageOnly,
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
      ],
    },
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
