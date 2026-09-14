import type { Block } from 'payload'

import { trimText } from '@/fields/linkValidation'
import {
  HEADER_CATEGORY_TABS_CATEGORIES_MAX,
  HEADER_CATEGORY_TABS_CATEGORIES_MIN,
} from '@/Header/policy'
import { cardItemsField, ctaField, enableCtaField, validateRequiredHeaderText } from './fields'

export const CategoryTabs: Block = {
  slug: 'categoryTabs',
  interfaceName: 'HeaderCategoryTabsBlock',
  labels: { singular: 'Category Tabs', plural: 'Category Tabs' },
  fields: [
    enableCtaField(),
    ctaField(),
    {
      name: 'categories',
      type: 'array',
      label: 'Categories',
      labels: { singular: 'Category', plural: 'Categories' },
      required: true,
      minRows: HEADER_CATEGORY_TABS_CATEGORIES_MIN,
      maxRows: HEADER_CATEGORY_TABS_CATEGORIES_MAX,
      admin: { initCollapsed: true },
      fields: [
        {
          name: 'label',
          type: 'text',
          required: true,
          hooks: { beforeChange: [trimText] },
          validate: validateRequiredHeaderText('category label'),
        },
        enableCtaField(),
        ctaField(),
        cardItemsField(),
      ],
    },
  ],
}
