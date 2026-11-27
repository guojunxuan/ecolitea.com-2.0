import type { TranslationRule } from './index'
import { blogBlockRules } from './blocks'
import { contentRule, prefixBlockRules, prefixRule, rowRule } from './shared'
export const blogsRule: TranslationRule = {
  ...contentRule,
  excerpt: 'translate',
  content: 'translate',
  ...prefixBlockRules('content', blogBlockRules),
  ...prefixRule('populatedAuthors[]', rowRule({ name: 'exclude' })),
}
