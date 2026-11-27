import type { SelectField } from 'payload'

export const heroThemeOptions: SelectField['options'] = [
  { label: 'dark', value: 'dark' },
  { label: 'light', value: 'light' },
]

export const heroThemeDescription =
  'Use dark for light text and icons over dark media, or light for dark text and icons over bright media. Applies to the Header and Hero foreground; it does not recolor the media.'
