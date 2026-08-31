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
      relationTo: 'media',
      required: true,
    },
    {
      name: 'logoDark',
      type: 'upload',
      relationTo: 'media',
      label: 'Logo for Dark Backgrounds',
    },
    {
      name: 'favicon',
      type: 'upload',
      relationTo: 'media',
      admin: {
        description: 'Use a square image suitable for a browser icon.',
      },
    },
  ],
}
