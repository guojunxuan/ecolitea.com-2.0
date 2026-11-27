import type { Block } from 'payload'
import { MediaBlock } from './MediaBlock/config'
import { KeyTakeaways } from './KeyTakeaways/config'
import { CallToAction } from './CallToAction/config'
import { Banner } from './Banner/config'

export const blogBlocks: Block[] = [MediaBlock, KeyTakeaways, CallToAction, Banner]
