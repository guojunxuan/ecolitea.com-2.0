'use client'

import { TextField, useField, useFormFields, useFormInitializing } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import React, { useEffect, useRef } from 'react'

export const AltPrefill: TextFieldClientComponent = (props) => {
  const { value, setValue } = useField<string>({ path: props.path })
  const initializing = useFormInitializing()
  const file = useFormFields(([fields]) => fields.file?.value)
  const selectedFile = useRef<unknown>(undefined)
  useEffect(() => {
    if (initializing || file === selectedFile.current) return
    selectedFile.current = file
    if (file instanceof File && !(typeof value === 'string' && value.trim())) {
      setValue(file.name.replace(/\.[^.]+$/, ''))
    }
  }, [file, initializing, value, setValue])
  return <TextField {...props} validate={() => true} />
}
