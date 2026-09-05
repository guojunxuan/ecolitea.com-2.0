import type {
  CollectionSlug,
  Field,
  GroupField,
  PolymorphicRelationshipField,
  RadioField,
  SingleRelationshipField,
  TextField,
} from 'payload'

import deepMerge from '@/utilities/deepMerge'

export type LinkAppearances = 'default' | 'outline'

export const appearanceOptions: Record<LinkAppearances, { label: string; value: string }> = {
  default: {
    label: 'Default',
    value: 'default',
  },
  outline: {
    label: 'Outline',
    value: 'outline',
  },
}

type LinkType = (options?: {
  appearances?: LinkAppearances[] | false
  disableLabel?: boolean
  labelOverrides?: Partial<TextField>
  overrides?: Partial<GroupField>
  relationTo?: CollectionSlug | CollectionSlug[]
  typeOverrides?: Partial<RadioField>
  urlOverrides?: Partial<TextField>
}) => Field

export const link: LinkType = ({
  appearances,
  disableLabel = false,
  labelOverrides = {},
  overrides = {},
  relationTo,
  typeOverrides = {},
  urlOverrides = {},
} = {}) => {
  const linkResult: GroupField = {
    name: 'link',
    type: 'group',
    admin: {
      hideGutter: true,
    },
    fields: [
      {
        type: 'row',
        fields: [
          deepMerge(
            {
              name: 'type',
              type: 'radio',
              admin: {
                layout: 'horizontal',
                width: '50%',
              },
              defaultValue: 'reference',
              options: [
                {
                  label: 'Internal link',
                  value: 'reference',
                },
                {
                  label: 'Custom URL',
                  value: 'custom',
                },
              ],
            } satisfies RadioField,
            typeOverrides,
          ),
          {
            name: 'newTab',
            type: 'checkbox',
            admin: {
              style: {
                alignSelf: 'flex-end',
              },
              width: '50%',
            },
            label: 'Open in new tab',
          },
        ],
      },
    ],
  }

  const referenceProperties = {
    name: 'reference',
    type: 'relationship',
    admin: {
      condition: (_, siblingData) => siblingData?.type === 'reference',
      ...(!disableLabel && { width: '50%' }),
    },
    label: 'Document to link to',
    required: true,
  } satisfies Omit<SingleRelationshipField, 'relationTo'>

  const referenceField =
    typeof relationTo === 'string'
      ? ({
          ...referenceProperties,
          relationTo,
        } satisfies SingleRelationshipField)
      : ({
          ...referenceProperties,
          relationTo: relationTo ?? ['pages', 'posts'],
        } satisfies PolymorphicRelationshipField)

  const urlField: TextField = deepMerge(
    {
      name: 'url',
      type: 'text',
      admin: {
        condition: (_, siblingData) => siblingData?.type === 'custom',
        ...(!disableLabel && { width: '50%' }),
      },
      label: 'Custom URL',
      required: true,
    } satisfies TextField,
    urlOverrides,
  )

  const linkTypes: Field[] = [referenceField, urlField]

  if (!disableLabel) {
    linkResult.fields.push({
      type: 'row',
      fields: [
        ...linkTypes,
        deepMerge(
          {
            name: 'label',
            type: 'text',
            admin: {
              width: '50%',
            },
            label: 'Label',
            required: true,
          },
          labelOverrides,
        ),
      ],
    })
  } else {
    linkResult.fields = [...linkResult.fields, ...linkTypes]
  }

  if (appearances !== false) {
    let appearanceOptionsToUse = [appearanceOptions.default, appearanceOptions.outline]

    if (appearances) {
      appearanceOptionsToUse = appearances.map((appearance) => appearanceOptions[appearance])
    }

    linkResult.fields.push({
      name: 'appearance',
      type: 'select',
      admin: {
        description: 'Choose how the link should be rendered.',
      },
      defaultValue: 'default',
      options: appearanceOptionsToUse,
    })
  }

  return deepMerge(linkResult, overrides)
}
