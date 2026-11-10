import type { CollapsibleField } from 'payload'

import { imageOnly } from '@/collections/mediaUploadPolicy'

import { heroThemeDescription, heroThemeOptions } from './heroTheme'
import { trimText, validateEnabledHeading, whenEnabled } from './validation'

export const listingHero = (): CollapsibleField => ({
  type: 'collapsible',
  label: 'Hero',
  admin: {
    initCollapsed: false,
    style: { marginTop: 0, marginBottom: 'var(--spacer-2-5)' },
  },
  fields: [
    {
      name: 'hero',
      label: false,
      type: 'group',
      admin: {
        hideGutter: true,
        description:
          'Configure the Hero title, description, responsive background images and Header Theme. Leave both media fields empty for a text-only Hero.',
      },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: false },
        {
          name: 'heading',
          label: 'Title',
          type: 'text',
          hooks: { beforeValidate: [trimText] },
          validate: validateEnabledHeading,
          admin: {
            condition: whenEnabled,
            description: 'Title displayed on the blog overview page. Category pages use their own title.',
          },
        },
        {
          name: 'description',
          type: 'textarea',
          hooks: { beforeValidate: [trimText] },
          admin: {
            condition: whenEnabled,
            description: 'Optional text displayed below the title. Category pages use their own description.',
          },
        },
        {
          name: 'image',
          label: 'Desktop media',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOnly,
          admin: {
            condition: whenEnabled,
            description:
              'Background image for desktop and the fallback for mobile. Images are cropped to fill the Hero using their focal point.',
          },
        },
        {
          name: 'mobileMedia',
          label: 'Mobile media',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOnly,
          admin: {
            condition: whenEnabled,
            description:
              'Optional background image for screens below 48rem. When empty, Desktop media is used with its focal point. If Desktop media is empty, this image is used on all screens.',
          },
        },
        {
          name: 'headerTheme',
          label: 'Header Theme',
          type: 'select',
          required: true,
          defaultValue: 'light',
          options: heroThemeOptions,
          admin: {
            condition: whenEnabled,
            description: heroThemeDescription,
          },
        },
      ],
    },
  ],
})
