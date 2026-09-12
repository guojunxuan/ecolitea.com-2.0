import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { createFolderField } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import { validateMediaUpload } from './mediaUploadPolicy'

export const Media: CollectionConfig = {
  slug: 'media',
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      //required: true,
    },
    {
      name: 'durationSeconds',
      type: 'number',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    createFolderField({ relationTo: 'folders' }),
    {
      name: 'caption',
      type: 'richText',
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  hooks: {
    beforeValidate: [validateMediaUpload],
  },
  upload: {
    adminThumbnail: ({ doc }) => (typeof doc.url === 'string' ? doc.url : null),
    crop: false,
    focalPoint: false,
  },
}
