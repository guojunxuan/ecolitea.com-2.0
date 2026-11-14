import type { CollectionConfig } from 'payload'
import { validations } from 'payload'

import { authenticated } from '@/access/authenticated'
import { QUOTE_LIMITS } from '@/utilities/quoteRequests/validate'

import { submitQuoteRequestEndpoint } from './endpoints/submit'

export const QuoteRequests: CollectionConfig = {
  slug: 'quote-requests',
  labels: { singular: 'Quote Request', plural: 'Quote Requests' },
  defaultSort: '-createdAt',
  admin: {
    group: 'Product',
    useAsTitle: 'name',
    defaultColumns: ['name', 'email', 'company', 'productTitle', 'status', 'createdAt'],
  },
  access: {
    // Public submissions only enter through the endpoint, which writes with the Local API.
    create: () => false,
    read: authenticated,
    update: authenticated,
    delete: authenticated,
  },
  endpoints: [submitQuoteRequestEndpoint],
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: QUOTE_LIMITS.name },
    {
      name: 'email',
      type: 'email',
      required: true,
      validate: (value, options) =>
        value && value.length > QUOTE_LIMITS.email
          ? `Email must be ${QUOTE_LIMITS.email} characters or fewer.`
          : validations.email(value, options),
    },
    { name: 'company', type: 'text', required: true, maxLength: QUOTE_LIMITS.company },
    { name: 'message', type: 'textarea', required: true, maxLength: QUOTE_LIMITS.message },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'new',
      index: true,
      options: [
        { label: 'New', value: 'new' },
        { label: 'Contacted', value: 'contacted' },
        { label: 'Closed', value: 'closed' },
      ],
    },
    {
      name: 'product',
      type: 'relationship',
      relationTo: 'products',
      admin: { readOnly: true, position: 'sidebar' },
    },
    {
      name: 'productTitle',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar', description: 'Snapshot at submission time.' },
    },
    {
      name: 'productSlug',
      type: 'text',
      admin: { readOnly: true, position: 'sidebar', description: 'Snapshot at submission time.' },
    },
    { name: 'userAgent', type: 'text', admin: { readOnly: true, position: 'sidebar' } },
    {
      name: 'ipHash',
      type: 'text',
      index: true,
      admin: { hidden: true, description: 'Salted hash used only for rate limiting.' },
    },
  ],
}
