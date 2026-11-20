'use client'

import { TextField, useDocumentInfo } from '@payloadcms/ui'
import type { TextFieldClientProps } from 'payload'
import React from 'react'

export const SocialPlatformNameField: React.FC<TextFieldClientProps> = (props) => {
  const { id } = useDocumentInfo()
  return <TextField {...props} readOnly={Boolean(id)} />
}
