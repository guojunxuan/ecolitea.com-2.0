import type { TranslationRule } from './index'
import { postBlockRules } from './blocks'
import { contentRule, prefixBlockRules, prefixRule, rowRule } from './shared'
export const postsRule: TranslationRule = {
  ...contentRule,
  content: 'translate',
  ...prefixBlockRules('content', postBlockRules),
  ...prefixRule('populatedAuthors[]', rowRule({ name: 'exclude' })),
}
