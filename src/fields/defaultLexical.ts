import type { TextFieldSingleValidation } from 'payload'
import {
  BoldFeature,
  BlockquoteFeature,
  FixedToolbarFeature,
  HeadingFeature,
  HorizontalRuleFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  LinkFeature,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  TableFeature,
  lexicalEditor,
  UnderlineFeature,
  UnorderedListFeature,
  type LinkFields,
} from '@payloadcms/richtext-lexical'

export const articleLinkFeature = () =>
  LinkFeature({
    enabledCollections: ['pages', 'posts', 'case-studies'],
    fields: ({ defaultFields }) => {
      const defaultFieldsWithoutUrl = defaultFields.filter((field) => {
        if ('name' in field && field.name === 'url') return false
        return true
      })

      return [
        ...defaultFieldsWithoutUrl,
        {
          name: 'url',
          type: 'text',
          admin: {
            condition: (_data, siblingData) => siblingData?.linkType !== 'internal',
          },
          label: ({ t }) => t('fields:enterURL'),
          required: true,
          validate: ((value, options) => {
            if ((options?.siblingData as LinkFields)?.linkType === 'internal') {
              return true // no validation needed, as no url should exist for internal links
            }
            return value ? true : 'URL is required'
          }) as TextFieldSingleValidation,
        },
      ]
    },
  })

export const defaultLexical = lexicalEditor({
  features: [
    ParagraphFeature(),
    HeadingFeature({ enabledHeadingSizes: ['h2', 'h3', 'h4'] }),
    BlockquoteFeature(),
    HorizontalRuleFeature(),
    TableFeature(),
    UnderlineFeature(),
    BoldFeature(),
    ItalicFeature(),
    StrikethroughFeature(),
    InlineCodeFeature(),
    SuperscriptFeature(),
    SubscriptFeature(),
    OrderedListFeature(),
    UnorderedListFeature(),
    articleLinkFeature(),
    FixedToolbarFeature(),
    InlineToolbarFeature(),
  ],
})
