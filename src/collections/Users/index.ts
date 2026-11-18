import { ValidationError, type CollectionConfig } from 'payload'

import { isAdmin, isAdminField } from '../../access/isAdmin'
import { authenticated } from '../../access/authenticated'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    admin: authenticated,
    create: isAdmin,
    delete: isAdmin,
    read: authenticated,
    update: ({ req: { user } }) => {
      if (!user) return false
      if (user.role === 'admin') return true
      return { id: { equals: user.id } }
    },
  },
  admin: {
    defaultColumns: ['name', 'email'],
    useAsTitle: 'name',
  },
  auth: true,
  hooks: {
    beforeChange: [
      async ({ data, operation, req }) => {
        if (operation === 'create') {
          const { totalDocs } = await req.payload.count({
            collection: 'users',
            overrideAccess: true,
            req,
          })
          if (totalDocs === 0) data.role = 'admin'
        }
        return data
      },
    ],
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      required: true,
      defaultValue: 'editor',
      saveToJWT: true,
      options: [
        { label: 'Admin', value: 'admin' },
        { label: 'Editor', value: 'editor' },
      ],
      access: { create: isAdminField, update: isAdminField, read: ({ req }) => Boolean(req.user) },
      hooks: {
        beforeValidate: [
          ({ value, data, req, operation, previousValue }) => {
            if (
              req.user &&
              req.user.role !== 'admin' &&
              data &&
              Object.prototype.hasOwnProperty.call(data, 'role') &&
              data.role !== (operation === 'create' ? 'editor' : previousValue)
            )
              throw new ValidationError({
                errors: [{ path: 'role', message: 'Only administrators can change roles.' }],
                req,
              })
            return value
          },
        ],
      },
    },
    {
      name: 'name',
      type: 'text',
    },
  ],
  timestamps: true,
  versions: false,
}
