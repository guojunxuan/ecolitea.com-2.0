import { blogCategoriesRule } from './blogCategories'
import { blogsRule } from './blogs'
import { caseStudiesRule } from './caseStudies'
import { footerRule } from './footer'
import { formsRule } from './forms'
import { headerRule } from './header'
import { mediaRule } from './media'
import { pagesRule } from './pages'
import { productCategoriesRule } from './productCategories'
import { productsRule } from './products'
import { settingsRule } from './settings'
import { siteSettingsRule } from './siteSettings'

export type TranslationRule = Readonly<Record<string, 'translate' | 'exclude'>>
export type RulePathSegment = { field: string; row: boolean; blockType?: string }

// Increment whenever a declared translation decision or path changes.
export const RULE_VERSION = 2
export const translationRules: Readonly<Record<string, TranslationRule>> = {
  products: productsRule,
  'product-categories': productCategoriesRule,
  blogs: blogsRule,
  'blog-categories': blogCategoriesRule,
  'case-studies': caseStudiesRule,
  pages: pagesRule,
  forms: formsRule,
  media: mediaRule,
  'global:header': headerRule,
  'global:footer': footerRule,
  'global:site-settings': siteSettingsRule,
  'global:settings': settingsRule,
}

export const getTranslationRule = (sourceCollection: string): TranslationRule | undefined =>
  Object.hasOwn(translationRules, sourceCollection) ? translationRules[sourceCollection] : undefined

/**
 * Schema paths use dotted field names, `array[]`, and `blocks[blockType=slug]`.
 * The latter also selects the fields of embedded Lexical Blocks. Runtime extract/merge
 * resolves each row by its stored id, never its position, and checks the declared blockType.
 * Group and tab layout wrappers without names do not add a path segment.
 */
export function parseRulePath(path: string): RulePathSegment[] {
  return path.split('.').map((part) => {
    const match = /^([a-zA-Z_][\w-]*)(\[\]|\[blockType=([\w-]+)\])?$/.exec(part)
    if (!match || ['__proto__', 'prototype', 'constructor'].includes(match[1])) {
      throw new Error(`Invalid translation rule path: ${path}`)
    }
    return { field: match[1], row: Boolean(match[2]), ...(match[3] ? { blockType: match[3] } : {}) }
  })
}
