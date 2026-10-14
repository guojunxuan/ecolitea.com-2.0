'use client'

import { FieldContext, TextField, useField, useForm, useFormFields } from '@payloadcms/ui'
import type { TextFieldClientComponent, Validate } from 'payload'
import React, { useCallback, useEffect, useRef } from 'react'

import { generateArticleShareURL } from '../fields/articleShareTemplate'

// Weak keys release this editor-only metadata when the Payload form is discarded.
const generatedTemplates = new WeakMap<object, Map<string, string>>()

export const ArticleShareURLField: TextFieldClientComponent = (props) => {
  const { field, path: pathFromProps, readOnly, validate } = props
  const validateText = useCallback<Validate>(
    (value, options) =>
      validate
        ? validate(value as string, {
            ...options,
            type: 'text',
            name: field.name,
            required: field.required,
            minLength: field.minLength,
            maxLength: field.maxLength,
          })
        : true,
    [validate, field.name, field.required, field.minLength, field.maxLength],
  )
  const controlledField = useField<string>({
    potentiallyStalePath: pathFromProps,
    validate: validateText,
  })
  const { path, value, setValue, disabled, formInitializing } = controlledField
  const { getFields } = useForm()
  const rowPath = path.slice(0, path.lastIndexOf('.'))
  const arrayPath = rowPath.slice(0, rowPath.lastIndexOf('.'))
  const rowIndex = Number(rowPath.slice(rowPath.lastIndexOf('.') + 1))
  const rowID = useFormFields(([fields]) => fields[arrayPath]?.rows?.[rowIndex]?.id)
  const namePath = `${rowPath}.name`
  const name = useFormFields(([fields]) => fields[namePath]?.value)
  // Fallback for a field rendered before the native array has supplied its row ID.
  const previousTemplate = useRef<string | null>(null)

  useEffect(() => {
    if (formInitializing || disabled || readOnly) return
    const template = generateArticleShareURL(typeof name === 'string' ? name : '')
    let formTemplates = generatedTemplates.get(getFields)
    if (!formTemplates) {
      formTemplates = new Map()
      generatedTemplates.set(getFields, formTemplates)
    }
    const rowKey = rowID ? `${arrayPath}:${rowID}` : null
    const priorTemplate =
      (rowKey ? formTemplates.get(rowKey) : previousTemplate.current) ?? template
    if (!value || value === priorTemplate) {
      if (value !== template) setValue(template)
      previousTemplate.current = template
    } else {
      previousTemplate.current = priorTemplate
    }
    if (rowKey) formTemplates.set(rowKey, previousTemplate.current)
  }, [name, rowID, arrayPath, getFields, value, setValue, disabled, formInitializing, readOnly])

  // The native field consumes this public context instead of registering a second useField.
  return (
    <FieldContext.Provider value={controlledField}>
      <TextField {...props} path={path} />
    </FieldContext.Provider>
  )
}
