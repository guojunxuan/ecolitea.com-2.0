import type { TextField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl, FieldValues, UseFormRegister } from 'react-hook-form'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import React from 'react'

import { Error } from '../Error'
import { useFormFieldIds } from '../useFormFieldIds'
import { Width } from '../Width'
import styles from './index.module.css'

export const Text: React.FC<
  TextField & {
    errors: Partial<FieldErrorsImpl>
    register: UseFormRegister<FieldValues>
  }
> = ({ name, defaultValue, errors, label, register, required, width }) => {
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
      <Input
        aria-describedby={errors[name] ? errorID : undefined}
        aria-invalid={errors[name] ? true : undefined}
        defaultValue={defaultValue}
        id={controlID}
        type="text"
        {...register(name, { required })}
      />
      {errors[name] && <Error id={errorID} name={name} />}
    </Width>
  )
}
