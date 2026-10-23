'use client'
import { useFormFields, useRowLabel, type RowLabelProps } from '@payloadcms/ui'
export const OptionValueRowLabel: React.FC<RowLabelProps> = () => {
  const { data, path, rowNumber } = useRowLabel<{ label?: string; swatch?: string }>()
  const parentPath = path.split('.').slice(0, -2).join('.')
  const display = useFormFields(([fields]) => fields[`${parentPath}.display`]?.value)
  return (
    <span>
      {display === 'swatch' && data?.swatch && (
        <span
          aria-label={`Color ${data.swatch}`}
          style={{
            display: 'inline-block',
            width: 12,
            height: 12,
            marginRight: 6,
            backgroundColor: data.swatch,
          }}
        />
      )}
      {data?.label?.trim() || `Value ${Number(rowNumber ?? 0) + 1}`}
    </span>
  )
}
