import type { TranslationRule } from './index'
import { caseStudyBlockRules } from './blocks'
import { contentRule, heroRule, prefixBlockRules, prefixRule } from './shared'
export const caseStudiesRule: TranslationRule = {
  ...contentRule,
  ...prefixRule('hero', heroRule),
  ...prefixBlockRules('layout', caseStudyBlockRules),
}
