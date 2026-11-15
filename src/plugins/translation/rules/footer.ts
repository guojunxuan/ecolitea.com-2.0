import type { TranslationRule } from './index'
import { linkRule, prefixRule, rowRule } from './shared'
export const footerRule: TranslationRule = {
  ...prefixRule(
    'columns[]',
    rowRule({
      label: 'translate',
      ...prefixRule('navItems[]', rowRule(prefixRule('link', linkRule))),
    }),
  ),
}
