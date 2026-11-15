import type { TranslationRule } from './index'
import { prefixRule, rowRule } from './shared'
export const categoriesRule: TranslationRule = {
  title: 'translate',
  slug: 'exclude',
  ...prefixRule('breadcrumbs[]', rowRule({ url: 'exclude', label: 'translate' })),
}
