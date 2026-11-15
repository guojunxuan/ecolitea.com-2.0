import type { TranslationRule } from './index'
import { blockRule, prefixBlockRules, prefixRule, rowRule } from './shared'

const labeledField = blockRule({ name: 'exclude', label: 'translate' })
export const formsRule: TranslationRule = {
  // Title identifies a form in Admin; notifications and submitted option values stay English.
  title: 'exclude',
  submitButtonLabel: 'translate',
  confirmationMessage: 'translate',
  'redirect.url': 'exclude',
  ...prefixBlockRules('fields', {
    checkbox: labeledField,
    country: labeledField,
    email: labeledField,
    message: blockRule({ message: 'translate' }),
    number: labeledField,
    select: blockRule({
      name: 'exclude',
      label: 'translate',
      defaultValue: 'exclude',
      placeholder: 'translate',
      ...prefixRule('options[]', rowRule({ label: 'translate', value: 'exclude' })),
    }),
    state: labeledField,
    text: blockRule({ name: 'exclude', label: 'translate', defaultValue: 'translate' }),
    textarea: blockRule({ name: 'exclude', label: 'translate', defaultValue: 'translate' }),
  }),
  ...prefixRule(
    'emails[]',
    rowRule({
      emailTo: 'exclude',
      cc: 'exclude',
      bcc: 'exclude',
      replyTo: 'exclude',
      emailFrom: 'exclude',
      subject: 'exclude',
      message: 'exclude',
    }),
  ),
}
