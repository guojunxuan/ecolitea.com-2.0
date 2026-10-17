import { createFolderField, type CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { DOCUMENT_UPLOAD_POLICY, documentUploadDescription } from './uploadPolicy'
import { validateDocumentUpload, validateDocumentUploadEarly } from './validateDocumentUpload'
import { validateTitle, validateTitleField } from './validateTitle'

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Documents' },
  versions: false,
  disableDuplicate: true,
  admin: {
    useAsTitle: 'title',
    description: documentUploadDescription,
    defaultColumns: ['title', 'filename', 'mimeType', 'filesize', '_h_folders', 'updatedAt'],
    listSearchableFields: ['title', 'filename'],
  },
  access: { create: authenticated, read: anyone, update: authenticated, delete: authenticated },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
      index: true,
      validate: validateTitleField,
      admin: { components: { Field: '@/collections/Documents/admin/TitlePrefill#TitlePrefill' } },
    },
    { name: 'description', type: 'textarea' },
    {
      name: 'filesize',
      type: 'number',
      admin: { components: { Cell: '@/collections/Documents/admin/FilesizeCell#FilesizeCell' } },
    },
    createFolderField({ relationTo: 'folders' }),
  ],
  hooks: {
    beforeOperation: [validateDocumentUploadEarly],
    beforeValidate: [validateDocumentUpload, validateTitle],
  },
  upload: {
    mimeTypes: Object.values(DOCUMENT_UPLOAD_POLICY.types).map(({ mimeType }) => mimeType),
    crop: false,
    focalPoint: false,
  },
}
