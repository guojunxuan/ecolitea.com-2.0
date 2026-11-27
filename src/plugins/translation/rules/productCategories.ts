import type { TranslationRule } from './index'
import { contentRule } from './shared'
export const productCategoriesRule: TranslationRule = {
  ...contentRule,
  description: 'translate',
  _order: 'exclude',
}
