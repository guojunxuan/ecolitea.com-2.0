import type { KeyTakeawaysBlock as Props } from '@/payload-types'
import RichText from '@/components/RichText'
import styles from './Component.module.css'

export const KeyTakeawaysBlock = ({ label = 'At a Glance', content }: Props) => (
  <aside className={styles.takeaways} aria-label={label || 'At a Glance'}>
    {label && <h2 className={styles.label}>{label}</h2>}
    <RichText data={content} enableGutter={false} />
  </aside>
)
