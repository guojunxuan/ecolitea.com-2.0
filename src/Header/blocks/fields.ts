import type { Field } from 'payload'

import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'
import { trimText, validateNonBlankText } from '@/fields/linkValidation'
import { labeledNavigationLink, unlabeledNavigationLink } from '@/Header/fields/links'
import { HEADER_CARD_ITEMS_MAX, HEADER_CARD_ITEMS_MIN } from '@/Header/policy'

export const validateRequiredHeaderText =
  (fieldName: string) =>
  (value?: unknown): string | true =>
    validateNonBlankText(value) === true ? true : `Please enter a ${fieldName}.`

export const enableCtaField = (): Field => ({
  name: 'enableCta',
  type: 'checkbox',
  label: 'Enable CTA',
  defaultValue: false,
})

export const ctaField = (): Field =>
  labeledNavigationLink({
    name: 'cta',
    label: 'CTA',
    admin: {
      condition: (_, siblingData) => siblingData?.enableCta === true,
    },
  })

export const enableHeadingField = (): Field => ({
  name: 'enableHeading',
  type: 'checkbox',
  label: 'Enable Heading',
  defaultValue: false,
})

export const headingField = (): Field => ({
  name: 'heading',
  type: 'text',
  required: true,
  hooks: { beforeChange: [trimText] },
  validate: validateRequiredHeaderText('heading'),
  admin: {
    condition: (_, siblingData) => siblingData?.enableHeading === true,
  },
})

export const cardItemFields = (): Field[] => [
  {
    name: 'image',
    type: 'upload',
    relationTo: 'media',
    required: true,
    filterOptions: {
      mimeType: {
        in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes],
      },
    },
  },
  {
    name: 'title',
    type: 'text',
    required: true,
    hooks: { beforeChange: [trimText] },
    validate: validateRequiredHeaderText('title'),
  },
  unlabeledNavigationLink({ label: 'Destination' }),
]

export const cardItemsField = (): Field => ({
  name: 'items',
  type: 'array',
  label: 'Cards',
  labels: { singular: 'Card', plural: 'Cards' },
  required: true,
  minRows: HEADER_CARD_ITEMS_MIN,
  maxRows: HEADER_CARD_ITEMS_MAX,
  admin: { initCollapsed: true },
  fields: cardItemFields(),
})
