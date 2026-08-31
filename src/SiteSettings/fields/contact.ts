import type { Tab } from 'payload'

export const contactTab: Tab = {
  label: 'Contact',
  admin: {
    description: 'Company contact details that may be reused across the website.',
  },
  fields: [
    {
      name: 'salesEmail',
      type: 'email',
      label: 'Sales Email',
    },
    {
      name: 'phone',
      type: 'text',
      admin: {
        description: 'Include the international dialing code.',
      },
    },
    {
      name: 'whatsapp',
      type: 'text',
      label: 'WhatsApp',
      admin: {
        description: 'Include the international dialing code.',
      },
    },
    {
      name: 'address',
      type: 'textarea',
    },
    {
      name: 'businessHours',
      type: 'textarea',
      label: 'Business Hours',
      admin: {
        description: 'Include the timezone when it helps international buyers.',
      },
    },
  ],
}
