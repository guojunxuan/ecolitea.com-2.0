import type { Block } from 'payload'

import { MediaBanner } from './MediaBanner/config'
import { MediaCarousel } from './MediaCarousel/config'
import { MediaTabs } from './MediaTabs/config'
import { MediaAccordion } from './MediaAccordion/config'
import { MediaText } from './MediaText/config'
import { Code } from './Code/config'

export const productBlocks: Block[] = [
  MediaBanner,
  MediaCarousel,
  MediaTabs,
  MediaAccordion,
  MediaText,
  Code,
]
