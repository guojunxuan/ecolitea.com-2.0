import type { CheckboxField } from '@payloadcms/plugin-form-builder/types'
import type { FieldErrorsImpl } from 'react-hook-form'

import { Controller, useFormContext } from 'react-hook-form'

import { Checkbox as CheckboxUi } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import React from 'react'

import { Error } from '../Error'
import { useFormFieldIds } from '../useFormFieldIds'
import { Width } from '../Width'
import styles from './index.module.css'

export const Checkbox: React.FC<
  CheckboxField & {
    errors: Partial<FieldErrorsImpl>
  }
> = ({ name, defaultValue, errors, label, required, width }) => {
  const { control } = useFormContext()
  const { controlID, errorID } = useFormFieldIds()

  return (
    <Width width={width}>
      <div className={styles.control}>
        <Controller
          control={control}
          name={name}
          defaultValue={defaultValue ?? false}
          rules={{ required }}
          render={({ field }) => (
            <CheckboxUi
              id={controlID}
              name={field.name}
              ref={field.ref}
              checked={field.value === true}
              onBlur={field.onBlur}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              aria-describedby={errors[name] ? errorID : undefined}
              aria-invalid={errors[name] ? true : undefined}
            />
          )}
        />
        <Label htmlFor={controlID}>
          {required && (
            <span className={styles.required}>
              * <span className={styles.requiredText}>(required)</span>
            </span>
          )}
          {label}
        </Label>
      </div>
      {errors[name] && <Error id={errorID} name={name} />}
    </Width>
  )
}
