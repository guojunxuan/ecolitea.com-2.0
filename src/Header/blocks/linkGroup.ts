import type { Block } from 'payload'

import { labeledNavigationLink } from '@/Header/fields/links'
import { HEADER_LINK_GROUP_LINKS_MAX, HEADER_LINK_GROUP_LINKS_MIN } from '@/Header/policy'
import { enableHeadingField, headingField } from './fields'

export const LinkGroup: Block = {
  slug: 'linkGroup',
  interfaceName: 'HeaderLinkGroupBlock',
  labels: { singular: 'Link Group', plural: 'Link Groups' },
  fields: [
    enableHeadingField(),
    headingField(),
    {
      name: 'links',
      type: 'array',
      label: 'Links',
      labels: { singular: 'Link', plural: 'Links' },
      required: true,
      minRows: HEADER_LINK_GROUP_LINKS_MIN,
      maxRows: HEADER_LINK_GROUP_LINKS_MAX,
      admin: { initCollapsed: true },
      fields: [labeledNavigationLink()],
    },
  ],
}
