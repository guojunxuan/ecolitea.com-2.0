'use client'

import { TextField, useDocumentInfo } from '@payloadcms/ui'
import type { TextFieldClientComponent } from 'payload'
import React from 'react'

export const SocialPlatformNameField: TextFieldClientComponent = (props) => {
  const { id } = useDocumentInfo()
  return <TextField {...props} readOnly={Boolean(id)} />
}
