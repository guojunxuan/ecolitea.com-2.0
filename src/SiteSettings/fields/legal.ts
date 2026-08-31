import type { Tab } from 'payload'

export const legalTab: Tab = {
  label: 'Legal',
  admin: {
    description: 'Legal identity and links used in site-wide disclosures.',
  },
  fields: [
    {
      name: 'copyrightText',
      type: 'text',
      label: 'Copyright Text',
    },
    {
      name: 'companyRegistrationNumber',
      type: 'text',
      label: 'Company Registration Number',
    },
    {
      name: 'privacyPolicyPage',
      type: 'relationship',
      relationTo: 'pages',
      label: 'Privacy Policy Page',
    },
    {
      name: 'termsPage',
      type: 'relationship',
      relationTo: 'pages',
      label: 'Terms Page',
    },
  ],
}
