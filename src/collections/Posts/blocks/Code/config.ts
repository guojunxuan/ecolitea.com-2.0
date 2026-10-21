import type { Block } from 'payload'

export const Code: Block = {
  slug: 'postCode',
  interfaceName: 'PostCodeBlock',
  labels: { singular: 'Code', plural: 'Codes' },
  admin: { group: 'Posts' },
  fields: [
    {
      name: 'language',
      type: 'select',
      defaultValue: 'typescript',
      options: [
        {
          label: 'Typescript',
          value: 'typescript',
        },
        {
          label: 'Javascript',
          value: 'javascript',
        },
        {
          label: 'CSS',
          value: 'css',
        },
      ],
    },
    {
      name: 'code',
      type: 'code',
      label: false,
      required: true,
    },
  ],
}
