import type { Field, GlobalBeforeChangeHook } from 'payload'
import { validGtmId } from '@/consent/gtm'
import { encryptedSecretFields } from '@/fields/encryptedSecret'
import { smtpSecret } from './email'

export const validateMonthlyCharLimit = (value: unknown): true | string =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? true
    : 'Enter a positive safe integer.'

const googleSecret = encryptedSecretFields({
  encrypted: 'googleTranslateApiKeyEncrypted',
  last4: 'googleTranslateApiKeyLast4',
  input: 'googleTranslateApiKeyInput',
  clear: 'googleTranslateApiKeyClear',
  label: 'Google Translate API key',
  statusName: 'googleTranslateKeyStatus',
  statusComponent: '@/SiteSettings/components/GoogleTranslateKeyStatus#GoogleTranslateKeyStatus',
})
export const protectIntegrationSecrets: GlobalBeforeChangeHook = (args) =>
  smtpSecret.protect({ ...args, data: googleSecret.protect(args) })

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
  ...googleSecret.fields,
]
