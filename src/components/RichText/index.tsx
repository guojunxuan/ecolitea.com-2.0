import { MediaBlock } from '@/blocks/MediaBlock/Component'
import {
  SerializedBlockNode,
  SerializedLinkNode,
  WithDefaultNodes,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'

import { CodeBlock, CodeBlockProps } from '@/blocks/Code/Component'

import type {
  BannerBlock as BannerBlockProps,
  CallToActionBlock as CTABlockProps,
  MediaBlock as MediaBlockProps,
} from '@/payload-types'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { cn } from '@/utilities/ui'

import styles from './index.module.css'

type NodeTypes = WithDefaultNodes<
  | SerializedBlockNode<BannerBlockProps>
  | SerializedBlockNode<CTABlockProps>
  | SerializedBlockNode<CodeBlockProps>
  | SerializedBlockNode<MediaBlockProps>
>

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }) => {
  const { value, relationTo } = linkNode.fields.doc!
  if (typeof value !== 'object') {
    throw new Error('Expected value to be an object')
  }
  const slug = value.slug
  return relationTo === 'posts' ? `/posts/${slug}` : `/${slug}`
}

const jsxConverters: JSXConvertersFunction<NodeTypes> = ({ defaultConverters }) => ({
  ...defaultConverters,
  ...LinkJSXConverter({ internalDocToHref }),
  blocks: {
    banner: ({ node }) => (
      <BannerBlock
        className={cn('payload-richtext__embedded', styles.embeddedBanner)}
        {...node.fields}
      />
    ),
    mediaBlock: ({ node }) => (
      <MediaBlock
        className={cn('payload-richtext__embedded', styles.embeddedMedia)}
        imgClassName={styles.mediaImage}
        {...node.fields}
        captionClassName={styles.mediaCaption}
        enableGutter={false}
        disableInnerContainer={true}
      />
    ),
    code: ({ node }) => (
      <CodeBlock
        className={cn('payload-richtext__embedded', styles.embeddedCode)}
        {...node.fields}
      />
    ),
    cta: ({ node }) => (
      <div className={cn('payload-richtext__embedded', styles.embeddedCTA)}>
        <CallToActionBlock {...node.fields} />
      </div>
    ),
  },
})

type Props = {
  data: SerializedEditorState
  enableGutter?: boolean
  enableProse?: boolean
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, ...rest } = props
  return (
    <ConvertRichText
      converters={jsxConverters}
      className={cn(
        'payload-richtext',
        styles.root,
        {
          'payload-richtext--content': enableProse,
          'payload-richtext--plain': !enableProse,
          [styles.plain]: !enableProse,
          [styles.withGutter]: enableGutter,
        },
        className,
      )}
      {...rest}
    />
  )
}
