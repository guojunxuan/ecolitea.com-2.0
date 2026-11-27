'use client'
import { useConfig, usePayloadAPI, useRowLabel, type RowLabelProps } from '@payloadcms/ui'

const CategoryTitle = ({ id, fallback }: { id: string; fallback: string }) => {
  const { config } = useConfig()
  const [{ data, isError }] = usePayloadAPI(
    `${config.routes.api}/product-categories/${encodeURIComponent(id)}`,
    { initialParams: { depth: 0 } },
  )
  return <span>{!isError && data?.title ? String(data.title) : fallback}</span>
}
export const CategoryCarouselRowLabel: React.FC<RowLabelProps> = () => {
  const { data, rowNumber } = useRowLabel<{ category?: string | { id: string; title?: string } }>()
  const fallback = `Category ${String(Number(rowNumber ?? 0) + 1).padStart(2, '0')}`
  if (!data?.category) return <span>{fallback}</span>
  if (typeof data.category === 'object' && data.category.title)
    return <span>{data.category.title}</span>
  return (
    <CategoryTitle
      key={typeof data.category === 'string' ? data.category : data.category.id}
      id={typeof data.category === 'string' ? data.category : data.category.id}
      fallback={fallback}
    />
  )
}
