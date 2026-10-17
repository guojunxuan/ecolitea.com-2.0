'use client'

import { TextField, useField, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import React, { useEffect } from 'react'

export const AltPrefill: TextFieldClientComponent = (props) => {
  const { value, setValue } = useField<string>({ path: props.path })
  const file = useFormFields(([fields]) => fields.file?.value)
  useEffect(() => {
    if (file instanceof File && !(typeof value === 'string' && value.trim())) {
      setValue(file.name.replace(/\.[^.]+$/, ''))
    }
  }, [file, value, setValue])
  return <TextField {...props} validate={() => true} />
}
