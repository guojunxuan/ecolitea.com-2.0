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
import { getHeadingText, slugifyHeadingText } from '@/utilities/blogs/extractTOC'
import { getContentPath } from '@/utilities/getContentPath'
import type { CollectionSlug } from 'payload'

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
  return typeof slug === 'string' ? getContentPath(relationTo as CollectionSlug, slug) || '#' : '#'
}

const jsxConverters =
  (headingIds?: readonly string[]): JSXConvertersFunction<NodeTypes> =>
  ({ defaultConverters }) => {
    let headingIndex = 0
    return {
      ...defaultConverters,
      ...LinkJSXConverter({ internalDocToHref }),
      ...(headingIds
        ? ({
            heading: ({ node, nodesToJSX, parent }) => {
              const Tag = node.tag
              const eligible =
                parent.type === 'root' &&
                (Tag === 'h2' || Tag === 'h3') &&
                slugifyHeadingText(getHeadingText(node))
              const id = eligible ? headingIds[headingIndex++] : undefined
              return <Tag id={id}>{nodesToJSX({ nodes: node.children })}</Tag>
            },
          } satisfies ReturnType<JSXConvertersFunction<NodeTypes>>)
        : {}),
      table: ({ node, nodesToJSX }) => (
        <div
          aria-label="Scrollable table"
          className={cn('payload-richtext__table-scroll', styles.tableScroll)}
          role="region"
          tabIndex={0}
        >
          <table>
            <tbody>{nodesToJSX({ nodes: node.children })}</tbody>
          </table>
        </div>
      ),
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
    }
  }

type Props = {
  data: SerializedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  headingIds?: readonly string[]
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const { className, enableProse = true, enableGutter = true, headingIds, ...rest } = props
  return (
    <ConvertRichText
      converters={jsxConverters(headingIds)}
      className={cn(
        'payload-richtext',
        styles.root,
        {
          'payload-richtext--content': enableProse,
          'payload-richtext--plain': !enableProse,
          [styles.content]: enableProse,
          [styles.plain]: !enableProse,
          [styles.withGutter]: enableGutter,
        },
        className,
      )}
      {...rest}
    />
  )
}
