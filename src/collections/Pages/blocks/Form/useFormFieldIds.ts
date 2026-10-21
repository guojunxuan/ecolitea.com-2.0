import { useId } from 'react'

export const useFormFieldIds = () => {
  const generatedID = useId()
  const controlID = `form-field-${generatedID}`

  return {
    controlID,
    errorID: `${controlID}-error`,
  }
}
