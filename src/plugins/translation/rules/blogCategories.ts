import type { TranslationRule } from './index'
import { contentRule } from './shared'
export const blogCategoriesRule: TranslationRule = {
  ...contentRule,
  description: 'translate',
  _order: 'exclude',
}
