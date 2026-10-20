import type { CollectionConfig } from 'payload'

import {
  FixedToolbarFeature,
  InlineToolbarFeature,
  lexicalEditor,
} from '@payloadcms/richtext-lexical'
import { createFolderField } from 'payload'

import { anyone } from '../access/anyone'
import { authenticated } from '../access/authenticated'
import {
  MEDIA_UPLOAD_POLICY,
  formatMediaUploadError,
  validateMediaUpload,
  validateMediaMimeType,
} from './mediaUploadPolicy'
import { validateMediaAlt, validateMediaAltField } from './mediaAlt'
import { preventReferencedDelete } from './mediaHooks/preventReferencedDelete'
import { mediaFileEndpoint } from './mediaEndpoints/file'
import { serverEnv } from '../utilities/env'
import { mediaReferencesEndpoint } from './mediaEndpoints/references'

export const Media: CollectionConfig = {
  slug: 'media',
  versions: false,
  defaultSort: '-createdAt',
  select: ({ select }) =>
    select?.width === true
      ? { ...select, height: true, mimeType: true, durationSeconds: true }
      : undefined,
  disableDuplicate: true,
  admin: {
    defaultColumns: ['filename', 'alt', 'mimeType', 'width', 'filesize', '_h_folders', 'updatedAt'],
    listSearchableFields: ['filename', 'alt'],
  },
  access: {
    create: authenticated,
    delete: authenticated,
    read: anyone,
    update: authenticated,
  },
  endpoints: [mediaReferencesEndpoint, mediaFileEndpoint],
  fields: [
    // The upload controls slot unmounts after file selection; this public UI
    // field keeps the crop dialog available through selected and existing files.
    {
      name: 'imageCrop',
      type: 'ui',
      admin: {
        components: { Field: '@/collections/mediaAdmin/ImageCropControls#ImageCropControls' },
      },
    },
    {
      name: 'usedIn',
      type: 'ui',
      label: 'Used in',
      admin: {
        position: 'sidebar',
        components: { Field: '@/collections/mediaAdmin/UsedInPanel#UsedInPanel' },
      },
    },
    // Payload merges overrides for native upload fields by name, retaining its
    // read-only/hidden defaults without creating duplicate persisted fields.
    {
      name: 'filename',
      label: 'Name',
      type: 'text',
      admin: { components: { Cell: '@/collections/mediaAdmin/FilenameCell#FilenameCell' } },
    },
    {
      name: 'width',
      label: 'Dimensions',
      type: 'number',
      admin: { components: { Cell: '@/collections/mediaAdmin/DimensionsCell#DimensionsCell' } },
    },
    {
      name: 'filesize',
      label: 'Size',
      type: 'number',
      admin: { components: { Cell: '@/collections/mediaAdmin/FilesizeCell#FilesizeCell' } },
    },
    {
      name: 'alt',
      validate: validateMediaAltField,
      label: 'Alt text',
      type: 'text',
      required: true,
      index: true,
      admin: {
        description: 'Describe the image for screen readers and search engines.',
        components: { Field: '@/collections/mediaAdmin/AltPrefill#AltPrefill' },
      },
    },
    {
      name: 'durationSeconds',
      type: 'number',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
    createFolderField({
      relationTo: 'folders',
      label: 'Folder',
      admin: { components: { Cell: '@/collections/mediaAdmin/FolderCell#FolderCell' } },
    }),
    {
      name: 'mimeType',
      type: 'text',
      label: 'Type',
      admin: { components: { Cell: '@/collections/mediaAdmin/TypeCell#TypeCell' } },
    },
    {
      name: 'updatedAt',
      type: 'date',
      label: 'updatedAt',
      admin: {
        condition: () => false,
        readOnly: true,
        components: { Cell: '@/collections/mediaAdmin/UpdatedAtCell#UpdatedAtCell' },
      },
    },
    {
      name: 'caption',
      type: 'richText',
      admin: {
        description:
          'Default caption shown when this media is used in a Media block. A caption set on the block overrides it.',
      },
      editor: lexicalEditor({
        features: ({ rootFeatures }) => {
          return [...rootFeatures, FixedToolbarFeature(), InlineToolbarFeature()]
        },
      }),
    },
  ],
  hooks: {
    afterError: [formatMediaUploadError],
    beforeDelete: [preventReferencedDelete],
    beforeOperation: [validateMediaMimeType],
    beforeValidate: [validateMediaUpload, validateMediaAlt],
  },
  upload: {
    admin: {
      components: { controls: ['@/collections/mediaAdmin/ImageCropControls#ImageCropControls'] },
    },
    mimeTypes: [...MEDIA_UPLOAD_POLICY.image.mimeTypes, ...MEDIA_UPLOAD_POLICY.video.mimeTypes],
    adminThumbnail: ({ doc }) =>
      `${serverEnv.NEXT_PUBLIC_SERVER_URL}/api/media/${encodeURIComponent(String(doc.id))}/file`,
    crop: false,
    focalPoint: true,
  },
}
