import React, { Fragment } from 'react'

import type { CaseStudy, Page } from '@/payload-types'

import { ArchiveBlock } from '@/blocks/ArchiveBlock/Component'
import { CallToActionBlock } from '@/blocks/CallToAction/Component'
import { ContentBlock } from '@/blocks/Content/Component'
import { FormBlock, type FormBlockType } from '@/blocks/Form/Component'
import { MediaBlock } from '@/blocks/MediaBlock/Component'
import styles from './RenderBlocks.module.css'

export type RenderBlocksProps = {
  blocks: Page['layout'] | CaseStudy['layout']
}

export const RenderBlocks: React.FC<RenderBlocksProps> = ({ blocks }) => {
  if (!blocks?.length) return null

  return (
    <Fragment>
      {blocks.map((block, index) => {
        let content: React.ReactNode

        switch (block.blockType) {
          case 'archive':
            content = <ArchiveBlock {...block} id={block.id ?? undefined} />
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
          case 'mediaBlock':
            content = <MediaBlock {...block} disableInnerContainer />
            break
          default:
            return null
        }

        return (
          <div className={styles.section} key={block.id || `${block.blockType}-${index}`}>
            {content}
          </div>
        )
      })}
    </Fragment>
  )
}
