import type { SelectField, Tab } from 'payload'

export const socialPlatformOptions = [
  { label: 'LinkedIn', value: 'linkedin' },
  { label: 'Facebook', value: 'facebook' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'YouTube', value: 'youtube' },
  { label: 'WhatsApp', value: 'whatsapp' },
  { label: 'WeChat', value: 'wechat' },
  { label: 'Xiaohongshu', value: 'xiaohongshu' },
] satisfies SelectField['options']

const invalidURLMessage = 'Enter a complete URL beginning with http:// or https://.'

export const validateAbsoluteHttpURL = (value: null | string | undefined): string | true => {
  if (!value) return true

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
          type: 'select',
          options: socialPlatformOptions,
          required: true,
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
