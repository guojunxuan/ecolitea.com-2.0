import {
  BoldFeature,
  FixedToolbarFeature,
  InlineCodeFeature,
  InlineToolbarFeature,
  ItalicFeature,
  lexicalEditor,
  OrderedListFeature,
  ParagraphFeature,
  StrikethroughFeature,
  SubscriptFeature,
  SuperscriptFeature,
  UnderlineFeature,
  UnorderedListFeature,
} from '@payloadcms/richtext-lexical'

import { articleLinkFeature } from './defaultLexical'

export const compactLexical = lexicalEditor({
  features: [
    ParagraphFeature(),
    BoldFeature(),
    ItalicFeature(),
    UnderlineFeature(),
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
