import type { Block } from 'payload'
import { CallToAction } from './CallToAction/config'
import { Content } from './Content/config'
import { MediaBlock } from './MediaBlock/config'
import { Archive } from './Archive/config'
import { FormBlock } from './Form/config'

export const pageBlocks: Block[] = [CallToAction, Content, MediaBlock, Archive, FormBlock]
