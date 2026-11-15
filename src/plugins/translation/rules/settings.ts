import type { TranslationRule } from './index'
import { linkRule, prefixRule, rowRule } from './shared'
export const settingsRule: TranslationRule = {
  ...prefixRule('blog', {
    'hero.heading': 'translate',
    'hero.description': 'translate',
    'seo.title': 'translate',
    'seo.description': 'translate',
    ...prefixRule('share.platforms[]', rowRule({ name: 'exclude', shareURL: 'exclude' })),
  }),
  ...prefixRule('product', {
    ...prefixRule(
      'heroSlides[]',
      rowRule({ title: 'translate', description: 'translate', ...prefixRule('cta', linkRule) }),
    ),
    ...prefixRule('categoryCarousel.items[]', rowRule({})),
    'seo.title': 'translate',
    'seo.description': 'translate',
  }),
}
