import type { TranslationRule } from './index'
import { productBlockRules } from './blocks'
import { contentRule, prefixBlockRules, prefixRule, rowRule } from './shared'

export const productsRule: TranslationRule = {
  ...contentRule,
  summary: 'translate',
  overview: 'translate',
  categorySlug: 'exclude',
  ...prefixRule(
    'specifications[]',
    rowRule({
      group: 'translate',
      ...prefixRule('items[]', rowRule({ label: 'translate', value: 'exclude' })),
    }),
  ),
  ...prefixRule(
    'sections[]',
    rowRule({
      label: 'translate',
      title: 'translate',
      description: 'translate',
      anchor: 'exclude',
      ...prefixBlockRules('blocks', productBlockRules),
    }),
  ),
}
