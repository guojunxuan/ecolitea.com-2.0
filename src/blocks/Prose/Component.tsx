import type { ProseBlock as Props } from '@/payload-types'
import RichText from '@/components/RichText'
import { cn } from '@/utilities/ui'
import styles from './Component.module.css'

export const ProseBlock = ({
  content,
  context = 'page',
  headingIds,
}: Props & { context?: 'page' | 'article'; headingIds?: string[] }) => (
  <div className={cn(styles.prose, context === 'article' && styles.article)}>
    <RichText
      data={content}
      enableGutter={false}
      headingIds={context === 'article' ? headingIds : undefined}
    />
  </div>
)
