import React, { Fragment } from 'react'

import type { Blog, CaseStudy, Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { BannerBlock } from '@/blocks/Banner/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock, type FormBlockType } from '@/blocks/Form/Component'
import { KeyTakeawaysBlock } from '@/blocks/KeyTakeaways/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import { ProseBlock } from '@/blocks/Prose/Component'
import styles from './RenderBlocks.module.css'

export type RenderBlocksProps = {
  blocks: Page['layout'] | CaseStudy['layout'] | Blog['content']
  context?: 'page' | 'article'
}

export const RenderBlocks: React.FC<RenderBlocksProps> = ({ blocks, context = 'page' }) => {
  if (!blocks?.length) return null

  return (
    <Fragment>
      {blocks.map((block, index) => {
        let content: React.ReactNode

        switch (block.blockType) {
          case 'archive':
            content = <ArchiveBlock {...block} id={block.id ?? undefined} />
            break
          case 'banner':
            content = <BannerBlock {...block} />
            break
          case 'content':
            content = <ContentBlock {...block} />
            break
          case 'cta':
            content = <CallToActionBlock {...block} />
            break
          case 'formBlock':
            if (typeof block.form !== 'object' || !block.form) return null
            content = (
              <FormBlock
                {...block}
                id={block.id ?? undefined}
                blockName={block.blockName ?? undefined}
                form={block.form as FormBlockType['form']}
                enableIntro={block.enableIntro ?? false}
                introContent={block.introContent ?? undefined}
              />
            )
            break
          case 'keyTakeaways':
            content = <KeyTakeawaysBlock {...block} />
            break
          case 'mediaBlock':
            content = <MediaBlock {...block} context={context} disableInnerContainer />
            break
          case 'prose':
            content = <ProseBlock {...block} context={context} />
            break
          default:
            return null
        }

        return (
          <div
            className={styles.section}
            data-block-context={context}
            key={block.id || `${block.blockType}-${index}`}
          >
            {content}
          </div>
        )
      })}
    </Fragment>
  )
}
