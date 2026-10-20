import { createFolderField, type CollectionConfig } from 'payload'
import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { DOCUMENT_UPLOAD_POLICY, documentUploadDescription } from './uploadPolicy'
import { validateDocumentUpload, validateDocumentUploadEarly } from './validateDocumentUpload'
import { validateTitle, validateTitleField } from './validateTitle'
import { serverEnv } from '@/utilities/env'
import { documentFileEndpoint } from './endpoints/file'
import { documentReferencesEndpoint } from './endpoints/references'
import { preventReferencedDelete } from './hooks/preventReferencedDelete'

export const Documents: CollectionConfig = {
  slug: 'documents',
  labels: { singular: 'Document', plural: 'Documents' },
  versions: false,
  defaultSort: '-createdAt',
  disableDuplicate: true,
  admin: {
    useAsTitle: 'title',
    description: documentUploadDescription,
    defaultColumns: ['title', 'filename', 'mimeType', 'filesize', '_h_folders', 'updatedAt'],
    listSearchableFields: ['title', 'filename'],
  },
  access: { create: authenticated, read: anyone, update: authenticated, delete: authenticated },
  endpoints: [documentFileEndpoint, documentReferencesEndpoint],
  fields: [
    {
      name: 'usedIn',
      type: 'ui',
      admin: {
        position: 'sidebar',
        components: { Field: '@/collections/Documents/admin/UsedInPanel#UsedInPanel' },
      },
    },
    {
      name: 'title',
      label: 'Title',
      type: 'text',
      required: true,
      index: true,
      validate: validateTitleField,
      admin: {
        description: 'Shown to editors when choosing this document.',
        components: { Field: '@/collections/Documents/admin/TitlePrefill#TitlePrefill' },
      },
    },
    {
      name: 'description',
      type: 'textarea',
      maxLength: 300,
      admin: { description: 'Optional short summary.' },
    },
    {
      name: 'filesize',
      label: 'Size',
      type: 'number',
      admin: { components: { Cell: '@/collections/Documents/admin/FilesizeCell#FilesizeCell' } },
    },
    createFolderField({
      relationTo: 'folders',
      label: 'Folder',
      admin: { components: { Cell: '@/collections/Documents/admin/FolderCell#FolderCell' } },
    }),
    { name: 'filename', type: 'text', label: 'File name' },
    {
      name: 'mimeType',
      type: 'text',
      label: 'Type',
      admin: { components: { Cell: '@/collections/Documents/admin/TypeCell#TypeCell' } },
    },
    {
      name: 'updatedAt',
      type: 'date',
      label: 'updatedAt',
      admin: {
        condition: () => false,
        readOnly: true,
        components: { Cell: '@/collections/Documents/admin/UpdatedAtCell#UpdatedAtCell' },
      },
    },
  ],
  hooks: {
    beforeDelete: [preventReferencedDelete],
    beforeOperation: [validateDocumentUploadEarly],
    beforeValidate: [validateDocumentUpload, validateTitle],
  },
  upload: {
    adminThumbnail: ({ doc }) =>
      doc.id
        ? `${serverEnv.NEXT_PUBLIC_SERVER_URL}/api/documents/${encodeURIComponent(String(doc.id))}/file`
        : null,
    mimeTypes: Object.values(DOCUMENT_UPLOAD_POLICY.types).map(({ mimeType }) => mimeType),
    crop: false,
    focalPoint: false,
  },
}
