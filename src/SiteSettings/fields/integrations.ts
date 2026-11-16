import { ValidationError, type Field, type FieldHook, type GlobalBeforeChangeHook } from 'payload'
import { isAdminField } from '@/access/isAdmin'
import { validGtmId } from '@/consent/gtm'
import { sealSecret } from '@/utilities/secretBox'

export const validateMonthlyCharLimit = (value: unknown): true | string =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? true
    : 'Enter a positive safe integer.'

// Field beforeValidate hooks run before Payload silently strips denied writes.
const denyDirectWrite: FieldHook = ({ value, req, field, data }) => {
  if (
    field.name &&
    data &&
    Object.prototype.hasOwnProperty.call(data, field.name) &&
    data[field.name] !== undefined
  )
    throw new ValidationError({
      errors: [
        { path: field.name, message: 'This field can only be changed through the API key input.' },
      ],
      req,
    })
  return value
}
const adminInput: FieldHook = ({ value, req, field }) => {
  if (
    value !== undefined &&
    value !== null &&
    value !== '' &&
    value !== false &&
    req.user?.role !== 'admin'
  )
    throw new ValidationError({
      errors: [
        {
          path: field.name ?? 'googleTranslateApiKeyInput',
          message: 'Only administrators can change the translation API key.',
        },
      ],
      req,
    })
  return value
}

export const protectIntegrationSecrets: GlobalBeforeChangeHook = ({ data, req }) => {
  if (!data) return data
  const key = data.googleTranslateApiKeyInput
  const clear = data.googleTranslateApiKeyClear === true
  if ((key || clear) && req.user?.role !== 'admin')
    throw new ValidationError({
      errors: [
        {
          path: 'googleTranslateApiKeyInput',
          message: 'Only administrators can change the translation API key.',
        },
      ],
      req,
    })
  if (clear && typeof key === 'string' && key.trim())
    throw new ValidationError({
      errors: [{ path: 'googleTranslateApiKeyInput', message: 'Choose either replace or clear.' }],
      req,
    })
  if (clear) {
    data.googleTranslateApiKeyEncrypted = null
    data.googleTranslateApiKeyLast4 = null
  } else if (typeof key === 'string' && key.trim()) {
    const value = key.trim()
    data.googleTranslateApiKeyEncrypted = sealSecret(value, req.payload.secret)
    data.googleTranslateApiKeyLast4 = value.slice(-4)
  }
  delete data.googleTranslateApiKeyInput
  delete data.googleTranslateApiKeyClear
  return data
}

export const integrationFields: Field[] = [
  {
    name: 'gtmContainerId',
    type: 'text',
    label: 'GTM Container ID',
    hooks: { beforeValidate: [({ value }) => (typeof value === 'string' ? value.trim() : value)] },
    validate: (value: unknown) =>
      !value || (typeof value === 'string' && validGtmId(value))
        ? true
        : 'Enter a container ID such as GTM-ABC123.',
  },
  {
    name: 'translationMonthlyCharLimit',
    type: 'number',
    required: true,
    defaultValue: 450000,
    min: 1,
    validate: validateMonthlyCharLimit,
    admin: { description: 'Application character budget per UTC calendar month.' },
  },
  {
    name: 'googleTranslateApiKeyEncrypted',
    type: 'text',
    admin: { hidden: true },
    access: { read: () => false, create: () => false, update: () => false },
    hooks: { beforeValidate: [denyDirectWrite] },
  },
  {
    name: 'googleTranslateApiKeyLast4',
    type: 'text',
    admin: { hidden: true, readOnly: true },
    access: { read: isAdminField, create: () => false, update: () => false },
    hooks: { beforeValidate: [denyDirectWrite] },
  },
  {
    name: 'googleTranslateKeyStatus',
    type: 'ui',
    admin: {
      components: {
        Field: '@/SiteSettings/components/GoogleTranslateKeyStatus#GoogleTranslateKeyStatus',
      },
    },
  },
  {
    name: 'googleTranslateApiKeyInput',
    label: 'Replace Google Translate API key',
    type: 'text',
    virtual: true,
    access: { read: isAdminField, create: isAdminField, update: isAdminField },
    hooks: { beforeValidate: [adminInput], afterRead: [() => null] },
    admin: {
      condition: (_data, _siblings, { user }) => user?.role === 'admin',
      readOnly: false,
      autoComplete: 'off',
      description: 'Leave empty to keep the stored key. The key is encrypted when saved.',
    },
  },
  {
    name: 'googleTranslateApiKeyClear',
    label: 'Clear Google Translate API key',
    type: 'checkbox',
    virtual: true,
    access: { read: isAdminField, create: isAdminField, update: isAdminField },
    hooks: { beforeValidate: [adminInput], afterRead: [() => false] },
    admin: { readOnly: false, condition: (_data, _siblings, { user }) => user?.role === 'admin' },
  },
]
