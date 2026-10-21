import type {
  BlogBannerBlock,
  BlogCallToActionBlock,
  BlogKeyTakeawaysBlock,
  BlogMediaBlock,
} from '@/payload-types'
import React from 'react'
import { cn } from '@/utilities/ui'
import {
  richTextEmbedClassNames as styles,
  type RichTextBlockConverters,
} from '@/components/RichText'
import { BannerBlock } from './Banner/Component'
import { CallToActionBlock } from './CallToAction/Component'
import { KeyTakeawaysBlock } from './KeyTakeaways/Component'
import { MediaBlock } from './MediaBlock/Component'

// Article Blocks own their width; the wrapper only marks the prose boundary and spacing.
const ArticleBlock = ({ children }: { children: React.ReactNode }) => (
  <div className={cn(styles.marker, styles.articleBlock)}>{children}</div>
)

export const blogRichTextBlocks: RichTextBlockConverters = {
  blogBanner: ({ node }) => (
    <ArticleBlock>
      <BannerBlock {...(node.fields as BlogBannerBlock)} />
    </ArticleBlock>
  ),
  blogCta: ({ node }) => (
    <ArticleBlock>
      <CallToActionBlock {...(node.fields as BlogCallToActionBlock)} context="article" />
    </ArticleBlock>
  ),
  blogKeyTakeaways: ({ node }) => (
    <ArticleBlock>
      <KeyTakeawaysBlock {...(node.fields as BlogKeyTakeawaysBlock)} />
    </ArticleBlock>
  ),
  blogMediaBlock: ({ node }) => (
    <ArticleBlock>
      <MediaBlock
        {...(node.fields as BlogMediaBlock)}
        context="article"
        enableGutter={false}
        disableInnerContainer
      />
    </ArticleBlock>
  ),
}
