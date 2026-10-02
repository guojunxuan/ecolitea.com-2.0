import { Field } from 'payload'

export const searchFields: Field[] = [
  {
    name: 'slug',
    type: 'text',
    index: true,
    admin: {
      readOnly: true,
    },
  },
  {
    name: 'excerpt',
    type: 'textarea',
    admin: { readOnly: true },
  },
  {
    name: 'heroImage',
    type: 'upload',
    relationTo: 'media',
    admin: { readOnly: true },
  },
  {
    name: 'publishedAt',
    type: 'date',
    admin: { readOnly: true },
  },
  {
    name: 'category',
    type: 'group',
    admin: { readOnly: true },
    fields: [
      { name: 'relationTo', type: 'text' },
      { name: 'categoryID', type: 'text' },
      { name: 'title', type: 'text' },
      { name: 'slug', type: 'text' },
    ],
  },
  {
    name: 'meta',
    label: 'Meta',
    type: 'group',
    index: true,
    admin: {
      readOnly: true,
    },
    fields: [
      {
        type: 'text',
        name: 'title',
        label: 'Title',
      },
      {
        type: 'text',
        name: 'description',
        label: 'Description',
      },
      {
        name: 'image',
        label: 'Image',
        type: 'upload',
        relationTo: 'media',
      },
    ],
  },
  {
    label: 'Categories',
    name: 'categories',
    type: 'array',
    admin: {
      readOnly: true,
    },
    fields: [
      {
        name: 'relationTo',
        type: 'text',
      },
      {
        name: 'categoryID',
        type: 'text',
      },
      {
        name: 'title',
        type: 'text',
      },
    ],
  },
]
