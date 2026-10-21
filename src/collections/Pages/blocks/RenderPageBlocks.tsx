import React, { Fragment } from 'react'

import type { Page } from '@/payload-types'

import { ArchiveBlock } from './Archive/Component'
import { CallToActionBlock } from './CallToAction/Component'
import { ContentBlock } from './Content/Component'
import { FormBlock, type FormBlockType } from './Form/Component'
import { MediaBlock } from './MediaBlock/Component'
import styles from './RenderPageBlocks.module.css'

export type RenderPageBlocksProps = {
  blocks: Page['layout']
}

export const RenderPageBlocks: React.FC<RenderPageBlocksProps> = ({ blocks }) => {
  if (!blocks?.length) return null

  return (
    <Fragment>
      {blocks.map((block, index) => {
        let content: React.ReactNode

        switch (block.blockType) {
          case 'pageArchive':
            content = <ArchiveBlock {...block} id={block.id ?? undefined} />
            break
          case 'pageContent':
            content = <ContentBlock {...block} />
            break
          case 'pageCta':
            content = <CallToActionBlock {...block} />
            break
          case 'pageFormBlock':
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
          case 'pageMediaBlock':
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
