import type { TranslationRule } from './index'
import { blockRule, linkRule, prefixRule, rowRule, unlabeledLinkRule } from './shared'

const cta = blockRule({
  heading: 'translate',
  description: 'translate',
  ...prefixRule('links[]', rowRule(prefixRule('link', linkRule))),
})
const content = blockRule({
  ...prefixRule('columns[]', rowRule({ richText: 'translate', ...prefixRule('link', linkRule) })),
})
const media = blockRule({ caption: 'translate' })
const banner = blockRule({ title: 'translate', content: 'translate' })

export const pageBlockRules: Readonly<Record<string, TranslationRule>> = {
  pageCta: cta,
  pageContent: content,
  pageMediaBlock: media,
  pageArchive: blockRule({ introContent: 'translate' }),
  pageFormBlock: blockRule({ introContent: 'translate' }),
}
export const caseStudyBlockRules: Readonly<Record<string, TranslationRule>> = {
  caseStudyCta: cta,
  caseStudyContent: content,
  caseStudyMediaBlock: media,
}
export const blogBlockRules: Readonly<Record<string, TranslationRule>> = {
  blogMediaBlock: media,
  blogKeyTakeaways: blockRule({ label: 'translate', content: 'translate' }),
  blogCta: cta,
  blogBanner: banner,
}
export const postBlockRules: Readonly<Record<string, TranslationRule>> = {
  postBanner: banner,
  postCode: blockRule({ code: 'exclude' }),
  postMediaBlock: media,
}
export const productBlockRules: Readonly<Record<string, TranslationRule>> = {
  productMediaBanner: blockRule({ title: 'translate', body: 'translate' }),
  productMediaCarousel: blockRule({
    title: 'translate',
    ...prefixRule('slides[]', rowRule({ caption: 'translate' })),
  }),
  productMediaTabs: blockRule({
    title: 'translate',
    ...prefixRule('tabs[]', rowRule({ title: 'translate', description: 'translate' })),
  }),
  productMediaAccordion: blockRule({
    title: 'translate',
    ...prefixRule('items[]', rowRule({ title: 'translate', body: 'translate' })),
  }),
  productMediaText: blockRule({ title: 'translate', body: 'translate' }),
  // The internal Admin label and executable source are shared; only the displayed title translates.
  productCode: blockRule({
    label: 'exclude',
    title: 'translate',
    html: 'exclude',
    css: 'exclude',
    js: 'exclude',
  }),
}

const cardItems = prefixRule(
  'items[]',
  rowRule({ title: 'translate', ...prefixRule('link', unlabeledLinkRule) }),
)
const ctaLink = prefixRule('cta', linkRule)
export const headerBlockRules: Readonly<Record<string, TranslationRule>> = {
  headerCategoryTabs: blockRule({
    ...ctaLink,
    ...prefixRule('categories[]', rowRule({ label: 'translate', ...ctaLink, ...cardItems })),
  }),
  headerCardGroup: blockRule({ heading: 'translate', ...ctaLink, ...cardItems }),
  headerLinkGroup: blockRule({
    heading: 'translate',
    ...prefixRule('links[]', rowRule(prefixRule('link', linkRule))),
  }),
  headerRichCard: blockRule({
    title: 'translate',
    description: 'translate',
    ...prefixRule('link', unlabeledLinkRule),
  }),
}
