'use client'

import * as React from 'react'
import { useFormContext } from 'react-hook-form'
import styles from './index.module.css'

export const Error = ({ id, name }: { id: string; name: string }) => {
  const {
    formState: { errors },
  } = useFormContext()
  return (
    <div className={styles.error} id={id} role="alert">
      {(errors[name]?.message as string) || 'This field is required'}
    </div>
  )
}
