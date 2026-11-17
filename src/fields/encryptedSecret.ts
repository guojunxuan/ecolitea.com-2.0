import { ValidationError, type Field, type FieldHook, type GlobalBeforeChangeHook } from 'payload'
import { isAdminField } from '@/access/isAdmin'
import { sealSecret } from '@/utilities/secretBox'

type Options = {
  encrypted: string
  last4: string
  input: string
  clear: string
  label: string
  statusName: string
  statusComponent?: string
  trim?: boolean
  readOnly?: () => boolean
}

/** Native write-only inputs plus server protection, shared by integration credentials. */
export function encryptedSecretFields(options: Options) {
  const { encrypted, last4, input, clear, label } = options
  const fail = (req: Parameters<FieldHook>[0]['req'], path: string, message: string): never => {
    throw new ValidationError({ errors: [{ path, message }], req })
  }
  const denyDirectWrite: FieldHook = ({ value, req, field, data }) => {
    if (field.name && data && Object.hasOwn(data, field.name) && data[field.name] !== undefined)
      fail(req, field.name, 'This field can only be changed through the credential input.')
    return value
  }
  const adminInput: FieldHook = ({ value, req, field }) => {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      if (req.user?.role !== 'admin')
        fail(req, field.name ?? input, 'Only administrators can change this credential.')
      if (options.readOnly?.())
        fail(req, field.name ?? input, 'Environment variables currently override these settings.')
    }
    return value
  }
  const canWrite = (args: Parameters<typeof isAdminField>[0]) =>
    args.req.user?.role === 'admin' && !options.readOnly?.()
  const fields: Field[] = [
    {
      name: encrypted,
      type: 'text',
      admin: { hidden: true },
      access: { read: () => false, create: () => false, update: () => false },
      hooks: { beforeValidate: [denyDirectWrite] },
    },
    {
      name: last4,
      type: 'text',
      admin: { hidden: true, readOnly: true },
      access: { read: isAdminField, create: () => false, update: () => false },
      hooks: { beforeValidate: [denyDirectWrite] },
    },
    {
      name: options.statusName,
      type: 'ui',
      admin: {
        components: {
          Field: options.statusComponent ?? {
            path: '@/fields/EncryptedSecretStatus#EncryptedSecretStatus',
            serverProps: { encryptedField: encrypted },
          },
        },
      },
    },
    {
      name: input,
      label: `Replace ${label}`,
      type: 'text',
      virtual: true,
      access: { read: isAdminField, create: canWrite, update: canWrite },
      hooks: { beforeValidate: [adminInput], afterRead: [() => null] },
      admin: {
        condition: (_data, _siblings, { user }) => user?.role === 'admin',
        readOnly: options.readOnly?.() ?? false,
        autoComplete: 'off',
        description: 'Leave empty to keep the stored credential. It is encrypted when saved.',
      },
    },
    {
      name: clear,
      label: `Clear ${label}`,
      type: 'checkbox',
      virtual: true,
      access: { read: isAdminField, create: canWrite, update: canWrite },
      hooks: { beforeValidate: [adminInput], afterRead: [() => false] },
      admin: {
        readOnly: options.readOnly?.() ?? false,
        condition: (_data, _siblings, { user }) => user?.role === 'admin',
      },
    },
  ]
  const protect = ({ data, req }: Parameters<GlobalBeforeChangeHook>[0]) => {
    if (!data) return data
    const raw = data[input]
    const value = typeof raw === 'string' ? (options.trim === false ? raw : raw.trim()) : ''
    const clearing = data[clear] === true
    if ((raw || clearing) && req.user?.role !== 'admin')
      fail(req, input, 'Only administrators can change this credential.')
    if ((value || clearing) && options.readOnly?.())
      fail(req, input, 'Environment variables currently override these settings.')
    if (clearing && value) fail(req, input, 'Choose either replace or clear.')
    if (clearing) {
      data[encrypted] = null
      data[last4] = null
    } else if (value) {
      data[encrypted] = sealSecret(value, req.payload.secret)
      data[last4] = value.slice(-4)
    }
    delete data[input]
    delete data[clear]
    return data
  }
  return { fields, protect }
}
