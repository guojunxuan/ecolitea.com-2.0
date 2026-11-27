import type { TranslationRule } from './index'
import { pageBlockRules } from './blocks'
import { contentRule, heroRule, prefixBlockRules, prefixRule } from './shared'
export const pagesRule: TranslationRule = {
  ...contentRule,
  ...prefixRule('hero', heroRule),
  ...prefixBlockRules('layout', pageBlockRules),
}
