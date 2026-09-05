import type { CollectionSlug, GroupField } from 'payload'

import { link } from '@/fields/link'
import { trimText, validateNavigationURL, validateNonBlankText } from '@/fields/linkValidation'

export const headerLinkTargets: CollectionSlug[] = ['pages', 'posts', 'case-studies', 'categories']

const headerURLOverrides = {
  hooks: { beforeChange: [trimText] },
  validate: validateNavigationURL,
}

export const labeledNavigationLink = (overrides: Partial<GroupField> = {}) =>
  link({
    appearances: false,
    relationTo: headerLinkTargets,
    typeOverrides: { required: true },
    labelOverrides: {
      hooks: { beforeChange: [trimText] },
      validate: validateNonBlankText,
    },
    urlOverrides: headerURLOverrides,
    overrides,
  })

export const unlabeledNavigationLink = (overrides: Partial<GroupField>) =>
  link({
    appearances: false,
    disableLabel: true,
    relationTo: headerLinkTargets,
    typeOverrides: { required: true },
    urlOverrides: headerURLOverrides,
    overrides,
  })
