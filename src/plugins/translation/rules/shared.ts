import type { TranslationRule } from './index'

// Helpers compose already-declared fields; they never inspect a schema or allow unknown fields.
export const prefixRule = (prefix: string, rule: TranslationRule): TranslationRule =>
  Object.fromEntries(Object.entries(rule).map(([path, action]) => [`${prefix}.${path}`, action]))

export const rowRule = (rule: TranslationRule): TranslationRule => ({ ...rule, id: 'exclude' })
export const blockRule = (rule: TranslationRule): TranslationRule =>
  rowRule({ ...rule, blockName: 'exclude' })

export const linkRule: TranslationRule = { label: 'translate', url: 'exclude' }
export const unlabeledLinkRule: TranslationRule = { url: 'exclude' }
export const contentRule: TranslationRule = {
  title: 'translate',
  'meta.title': 'translate',
  'meta.description': 'translate',
  slug: 'exclude',
}
export const heroRule: TranslationRule = {
  richText: 'translate',
  ...prefixRule('links[]', rowRule(prefixRule('link', linkRule))),
}

export const prefixBlockRules = (
  prefix: string,
  blocks: Readonly<Record<string, TranslationRule>>,
): TranslationRule =>
  Object.assign(
    {},
    ...Object.entries(blocks).map(([type, rule]) =>
      prefixRule(`${prefix}[blockType=${type}]`, rule),
    ),
  )
