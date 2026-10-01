import type { ProseBlock as Props } from '@/payload-types'
import RichText from '@/components/RichText'
import styles from './Component.module.css'

export const ProseBlock = ({ content }: Props) => (
  <div className={styles.prose}>
    <RichText data={content} enableGutter={false} />
  </div>
)
