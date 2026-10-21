import type { PostBannerBlock, PostMediaBlock } from '@/payload-types'
import React from 'react'
import { cn } from '@/utilities/ui'
import {
  richTextEmbedClassNames as styles,
  type RichTextBlockConverters,
} from '@/components/RichText'
import { BannerBlock } from './Banner/Component'
import { MediaBlock } from './MediaBlock/Component'
import { CodeBlock, type CodeBlockProps } from './Code/Component'

export const postRichTextBlocks: RichTextBlockConverters = {
  postBanner: ({ node }) => (
    <BannerBlock
      className={cn(styles.marker, styles.banner)}
      {...(node.fields as PostBannerBlock)}
    />
  ),
  postMediaBlock: ({ node }) => (
    <MediaBlock
      className={cn(styles.marker, styles.media)}
      imgClassName={styles.mediaImage}
      {...(node.fields as PostMediaBlock)}
      captionClassName={styles.mediaCaption}
      enableGutter={false}
      disableInnerContainer={true}
    />
  ),
  postCode: ({ node }) => (
    <CodeBlock
      className={cn(styles.marker, styles.code)}
      {...(node.fields as unknown as CodeBlockProps)}
    />
  ),
}
