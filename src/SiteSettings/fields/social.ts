import type { Tab } from 'payload'

import { socialPlatformsSlug } from '@/collections/SocialPlatforms'

type SocialLinkValue = {
  platform?: null | number | string | { id?: number | string; platform?: string }
}

export const validateUniqueSocialPlatforms = (
  value: null | unknown[] | undefined,
): string | true => {
  if (!Array.isArray(value)) return true

  const seen = new Map<string, { label?: string; row: number }>()
  for (const [index, unknownRow] of value.entries()) {
    const row = unknownRow as SocialLinkValue
    const relationship = row?.platform
    if (relationship == null) continue
    const id = typeof relationship === 'object' ? relationship.id : relationship
    if (id == null) continue
    const key = String(id)
    const existing = seen.get(key)
    if (existing) {
      const platform = existing.label ? `Platform "${existing.label}"` : 'This Platform'
      return `${platform} is already selected in Social Link row ${existing.row} and cannot be selected again in row ${index + 1}.`
    }
    seen.set(key, {
      label:
        typeof relationship === 'object' && relationship.platform
          ? relationship.platform
          : undefined,
      row: index + 1,
    })
  }

  return true
}

const invalidURLMessage = 'Enter a complete URL beginning with http:// or https://.'
const requiredURLMessage = 'This field is required.'

export const validateAbsoluteHttpURL = (value: null | string | undefined): string | true => {
  if (!value) return requiredURLMessage
  if (!/^https?:\/\//i.test(value)) return invalidURLMessage

  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:' ? true : invalidURLMessage
  } catch {
    return invalidURLMessage
  }
}

export const socialTab: Tab = {
  label: 'Social',
  admin: {
    description: 'Public social and messaging profiles.',
  },
  fields: [
    {
      name: 'createSocialPlatform',
      type: 'ui',
      admin: {
        components: {
          Field:
            '@/SiteSettings/components/SocialPlatformCreateActions#SocialPlatformCreateActions',
        },
      },
    },
    {
      name: 'socialLinks',
      type: 'array',
      label: 'Social Links',
      labels: {
        singular: 'Social Link',
        plural: 'Social Links',
      },
      validate: validateUniqueSocialPlatforms,
      admin: {
        components: {
          Field: '@/SiteSettings/components/SocialLinksArrayField#SocialLinksArrayField',
          RowLabel: '@/SiteSettings/components/SocialLinkRowLabel#SocialLinkRowLabel',
        },
      },
      fields: [
        {
          name: 'platform',
          type: 'relationship',
          relationTo: socialPlatformsSlug,
          required: true,
          admin: {
            allowCreate: false,
            components: {
              Field:
                '@/SiteSettings/components/SocialPlatformRelationshipField#SocialPlatformRelationshipField',
            },
          },
        },
        {
          name: 'url',
          type: 'text',
          label: 'URL',
          required: true,
          validate: validateAbsoluteHttpURL,
        },
      ],
    },
  ],
}
