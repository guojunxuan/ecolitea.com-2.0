import type { Field } from 'payload'

export const themeField: Field = {
  name: 'theme',
  type: 'select',
  options: [
    { label: 'Default', value: 'default' },
    { label: 'Inverse', value: 'inverse' },
  ],
  admin: { isClearable: true, placeholder: 'Inherit surrounding theme' },
}
