import type { Block } from 'payload'
import { Banner } from './Banner/config'
import { Code } from './Code/config'
import { MediaBlock } from './MediaBlock/config'

export const postBlocks: Block[] = [Banner, Code, MediaBlock]
