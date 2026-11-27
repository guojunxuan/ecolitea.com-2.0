import type { Field } from 'payload'
import { isAdminField } from '@/access/isAdmin'
import { encryptedSecretFields } from '@/fields/encryptedSecret'
import { isSmtpEmailAddress } from '@/utilities/env'

const environmentOverrides = () => Boolean(process.env.SMTP_HOST?.trim())
export const smtpSecret = encryptedSecretFields({
  encrypted: 'smtpPasswordEncrypted',
  last4: 'smtpPasswordLast4',
  input: 'smtpPasswordInput',
  clear: 'smtpPasswordClear',
  label: 'SMTP password',
  statusName: 'smtpPasswordStatus',
  trim: false,
  readOnly: environmentOverrides,
})
const connectionAccess = {
  read: isAdminField,
  create: (args: Parameters<typeof isAdminField>[0]) =>
    args.req.user?.role === 'admin' && !environmentOverrides(),
  update: (args: Parameters<typeof isAdminField>[0]) =>
    args.req.user?.role === 'admin' && !environmentOverrides(),
}
const text = (name: string, label: string): Field => ({
  name,
  label,
  type: 'text',
  access: connectionAccess,
  admin: { readOnly: environmentOverrides() },
})
export const emailFields: Field[] = [
  {
    name: 'emailStatus',
    type: 'ui',
    admin: { components: { Field: '@/plugins/email/admin/EmailStatus#EmailStatus' } },
  },
  text('smtpHost', 'SMTP host'),
  {
    name: 'smtpPort',
    label: 'SMTP port',
    type: 'number',
    defaultValue: 587,
    min: 1,
    max: 65535,
    access: connectionAccess,
    validate: (value: unknown) =>
      value == null ||
      (typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 65535)
        ? true
        : 'Enter an integer port from 1 to 65535.',
    admin: { readOnly: environmentOverrides() },
  },
  {
    name: 'smtpSecurity',
    label: 'SMTP security',
    type: 'select',
    defaultValue: 'starttls',
    options: [
      { label: 'None', value: 'none' },
      { label: 'STARTTLS', value: 'starttls' },
      { label: 'TLS', value: 'tls' },
    ],
    access: connectionAccess,
    admin: { readOnly: environmentOverrides() },
  },
  text('smtpUser', 'SMTP username'),
  ...smtpSecret.fields,
  {
    ...text('smtpFromAddress', 'From address'),
    validate: (value: unknown) =>
      !value || isSmtpEmailAddress(value) ? true : 'Enter a valid email address.',
  } as Field,
  text('smtpFromName', 'From name'),
  {
    name: 'emailTest',
    type: 'ui',
    admin: { components: { Field: '@/plugins/email/admin/TestEmailButton#TestEmailButton' } },
  },
]
export const emailNotificationFields: Field[] = [
  {
    name: 'quoteNotificationsEnabled',
    label: 'Quote notifications enabled',
    type: 'checkbox',
    defaultValue: true,
    access: { read: isAdminField, create: isAdminField, update: isAdminField },
  },
  {
    name: 'quoteNotificationRecipients',
    label: 'Quote notification recipients',
    type: 'array',
    access: { read: isAdminField, create: isAdminField, update: isAdminField },
    admin: { description: 'Leave empty to send notifications to the Contact Details email.' },
    fields: [{ name: 'email', type: 'email', required: true }],
  },
]
