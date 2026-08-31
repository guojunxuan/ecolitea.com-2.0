import type { Tab } from 'payload'

export const generalTab: Tab = {
  label: 'General',
  admin: {
    description: 'Core public identity for the website and company.',
  },
  fields: [
    {
      name: 'siteName',
      type: 'text',
      label: 'Site Name',
      required: true,
    },
    {
      name: 'legalCompanyName',
      type: 'text',
      label: 'Legal Company Name',
    },
    {
      name: 'tagline',
      type: 'text',
    },
    {
      name: 'siteDescription',
      type: 'textarea',
      label: 'Site Description',
      admin: {
        description: 'A general company description, not a default SEO description.',
      },
    },
  ],
}
