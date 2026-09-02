import type { Tab } from 'payload'

import { socialPlatformsSlug } from '@/collections/SocialPlatforms'

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
          name: 'label',
          type: 'text',
          admin: {
            description: 'Optional public label. The platform name can be used when empty.',
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
