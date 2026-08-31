import type { Tab } from 'payload'

export const brandingTab: Tab = {
  label: 'Branding',
  admin: {
    description: 'Shared brand assets used across the website.',
  },
  fields: [
    {
      name: 'logo',
      type: 'upload',
      relationTo: 'brand-assets',
      required: true,
      filterOptions: {
        mimeType: {
          equals: 'image/svg+xml',
        },
      },
      admin: {
        description: 'Upload a horizontal SVG logo with a tight viewBox.',
      },
    },
    {
      name: 'logoDark',
      type: 'upload',
      relationTo: 'brand-assets',
      label: 'Logo for Dark Backgrounds',
      filterOptions: {
        mimeType: {
          equals: 'image/svg+xml',
        },
      },
      admin: {
        description: 'Optional SVG variant for dark backgrounds. Falls back to Logo.',
      },
    },
    {
      name: 'favicon',
      type: 'upload',
      relationTo: 'brand-assets',
      filterOptions: {
        mimeType: {
          in: ['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
        },
      },
      admin: {
        description: 'Use a square SVG, PNG, or ICO image suitable for a browser icon.',
      },
    },
  ],
}
