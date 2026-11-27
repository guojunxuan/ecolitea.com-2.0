import type { TranslationRule } from './index'
import { headerBlockRules } from './blocks'
import { linkRule, prefixBlockRules, prefixRule, rowRule, unlabeledLinkRule } from './shared'
export const headerRule: TranslationRule = {
  ...prefixRule(
    'navItems[]',
    rowRule({
      label: 'translate',
      ...prefixRule('link', unlabeledLinkRule),
      ...prefixBlockRules('content', headerBlockRules),
    }),
  ),
  ...prefixRule('menuCta', linkRule),
}
