import type { CollapsibleField } from 'payload'

import { imageOnly } from '@/collections/mediaUploadPolicy'

import { trimText, validateEnabledHeading, whenEnabled } from './validation'

export const listingHero = (): CollapsibleField => ({
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
})
