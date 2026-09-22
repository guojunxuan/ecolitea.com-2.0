import RichText from '@/components/RichText'
import React from 'react'

import { Width } from '../Width'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import styles from './index.module.css'

export const Message: React.FC<{ message: SerializedEditorState }> = ({ message }) => {
  return (
    <Width className={styles.message} width="100">
      {message && <RichText data={message} />}
    </Width>
  )
}
