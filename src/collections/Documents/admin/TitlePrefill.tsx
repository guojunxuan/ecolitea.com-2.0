'use client'

import { TextField, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import React, { useEffect, useRef } from 'react'

export const TitlePrefill: TextFieldClientComponent = (props) => {
  const { value, setValue } = useField<string>({ path: props.path })
  const file = useFormFields(([fields]) => fields.file?.value)
  const selectedFile = useRef<unknown>(undefined)
  useEffect(() => {
    if (file === selectedFile.current) return
    selectedFile.current = file
    if (file instanceof File && !(typeof value === 'string' && value.trim()))
      setValue(file.name.replace(/\.[^.]+$/, ''))
  }, [file, value, setValue])
  return <TextField {...props} validate={() => true} />
}
