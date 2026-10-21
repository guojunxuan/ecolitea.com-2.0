import React, { Fragment } from 'react'

import type { CaseStudy } from '@/payload-types'

import { CallToActionBlock } from './CallToAction/Component'
import { ContentBlock } from './Content/Component'
import { MediaBlock } from './MediaBlock/Component'
import styles from './RenderCaseStudyBlocks.module.css'

export type RenderCaseStudyBlocksProps = {
  blocks: CaseStudy['layout']
}

export const RenderCaseStudyBlocks: React.FC<RenderCaseStudyBlocksProps> = ({ blocks }) => {
  if (!blocks?.length) return null

  return (
    <Fragment>
      {blocks.map((block, index) => {
        let content: React.ReactNode

        switch (block.blockType) {
          case 'caseStudyContent':
            content = <ContentBlock {...block} />
            break
          case 'caseStudyCta':
            content = <CallToActionBlock {...block} />
            break
          case 'caseStudyMediaBlock':
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
