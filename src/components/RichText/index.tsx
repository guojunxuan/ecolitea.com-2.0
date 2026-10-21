import { SerializedLinkNode } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  JSXConvertersFunction,
  LinkJSXConverter,
  RichText as ConvertRichText,
} from '@payloadcms/richtext-lexical/react'
import { cn } from '@/utilities/ui'
import { getHeadingText, slugifyHeadingText } from '@/utilities/blogs/extractTOC'
import { getContentPath } from '@/utilities/getContentPath'
import type { CollectionSlug } from 'payload'
import styles from './index.module.css'

type RichTextContext = 'page' | 'article'
export type RichTextBlockConverters = NonNullable<ReturnType<JSXConvertersFunction>['blocks']>
export const richTextEmbedClassNames = {
  marker: 'payload-richtext__embedded',
  banner: styles.embeddedBanner,
  media: styles.embeddedMedia,
  mediaImage: styles.mediaImage,
  mediaCaption: styles.mediaCaption,
  code: styles.embeddedCode,
  articleBlock: styles.articleBlock,
}

const internalDocToHref = ({ linkNode }: { linkNode: SerializedLinkNode }) => {
  const { value, relationTo } = linkNode.fields.doc ?? {}
  // Payload preserves IDs when a relationship is unavailable to this reader.
  if (!value || typeof value !== 'object') return '#'
  const slug = value.slug
  return typeof slug === 'string' ? getContentPath(relationTo as CollectionSlug, slug) || '#' : '#'
}

const jsxConverters =
  (blocks: RichTextBlockConverters, headingIds?: readonly string[]): JSXConvertersFunction =>
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
          } satisfies ReturnType<JSXConvertersFunction>)
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
      blocks,
    }
  }

type Props = {
  blocks?: RichTextBlockConverters
  context?: RichTextContext
  data: SerializedEditorState
  enableGutter?: boolean
  enableProse?: boolean
  headingIds?: readonly string[]
} & React.HTMLAttributes<HTMLDivElement>

export default function RichText(props: Props) {
  const {
    className,
    blocks = {},
    context = 'page',
    enableProse = true,
    enableGutter = true,
    headingIds,
    ...rest
  } = props
  return (
    <ConvertRichText
      converters={jsxConverters(blocks, headingIds)}
      className={cn(
        'payload-richtext',
        styles.root,
        {
          'payload-richtext--content': enableProse,
          'payload-richtext--plain': !enableProse,
          [styles.content]: enableProse,
          [styles.plain]: !enableProse,
          [styles.withGutter]: enableGutter,
          [styles.article]: context === 'article',
        },
        className,
      )}
      {...rest}
    />
  )
}
