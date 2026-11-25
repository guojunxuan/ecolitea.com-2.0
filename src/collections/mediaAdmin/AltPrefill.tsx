'use client'

import {
  TextField,
  useDocumentInfo,
  useField,
  useFormFields,
  useFormInitializing,
} from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import React, { useEffect, useRef } from 'react'

export const AltPrefill: React.FC<TextFieldClientProps> = (props) => {
  const { value, setValue } = useField<string>({ path: props.path })
  const initializing = useFormInitializing()
  const { hasSavePermission, isTrashed } = useDocumentInfo()
  const file = useFormFields(([fields]) => fields.file?.value)
  const selectedFile = useRef<unknown>(undefined)
  useEffect(() => {
    if (initializing || file === selectedFile.current) return
    selectedFile.current = file
    if (file instanceof File && !(typeof value === 'string' && value.trim())) {
      setValue(file.name.replace(/\.[^.]+$/, ''))
    }
  }, [file, initializing, value, setValue])
  // Bulk Upload renders this server component before its shared permissions load, so the
  // server-computed readOnly stays true. Derive it from the live document permissions instead.
  const readOnly = Boolean(props.field?.admin?.readOnly || isTrashed || !hasSavePermission)
  return <TextField {...props} readOnly={readOnly} validate={() => true} />
}
