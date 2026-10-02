import type { ProseBlock as Props } from '@/payload-types'
import RichText from '@/components/RichText'
import { cn } from '@/utilities/ui'
import styles from './Component.module.css'

export const ProseBlock = ({ content, context = 'page' }: Props & { context?: 'page' | 'article' }) => (
  <div className={cn(styles.prose, context === 'article' && styles.article)}>
    <RichText data={content} enableGutter={false} />
  </div>
)
