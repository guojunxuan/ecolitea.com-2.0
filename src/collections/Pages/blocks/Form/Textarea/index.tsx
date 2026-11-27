import type { TextField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { Label } from '@/components/ui/label'
import { Textarea as TextAreaComponent } from '@/components/ui/textarea'
import React from 'react'

import { Error } from '../Error'
import { useFormFieldIds } from '../useFormFieldIds'
import { Width } from '../Width'
import styles from './index.module.css'

export const Textarea: React.FC<
  TextField & {
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
    rows?: number
  }
> = ({ name, defaultValue, errors, label, register, required, rows = 3, width }) => {
  const { controlID, errorID } = useFormFieldIds()

  return (
    <Width width={width}>
      <Label htmlFor={controlID}>
        {label}

        {required && (
          <span className={styles.required}>
            * <span className={styles.requiredText}>(required)</span>
          </span>
        )}
      </Label>

      <TextAreaComponent
        aria-describedby={errors[name] ? errorID : undefined}
        aria-invalid={errors[name] ? true : undefined}
        defaultValue={defaultValue}
        id={controlID}
        rows={rows}
        {...register(name, { required: required })}
      />

      {errors[name] && <Error id={errorID} name={name} />}
    </Width>
  )
}
