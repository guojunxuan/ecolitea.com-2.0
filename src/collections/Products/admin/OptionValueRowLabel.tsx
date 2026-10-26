'use client'

import {
  Thumbnail,
  useConfig,
  useFormFields,
  usePayloadAPI,
  useRowLabel,
  type RowLabelProps,
} from '@payloadcms/ui'
import type { Media } from '@/payload-types'
import styles from './OptionValueRowLabel.module.css'

type Image = string | Media
const ImagePreview = ({ image }: { image: Media }) => (
  <Thumbnail
    className={styles.image}
    collectionSlug="media"
    doc={{ filename: image.filename }}
    fileSrc={image.thumbnailURL || image.url || undefined}
    width={20}
    height={20}
    size="none"
  />
)
function LoadedImage({ id }: { id: string }) {
  const { config } = useConfig()
  const [{ data, isError, isLoading }] = usePayloadAPI(
    `${config.routes.api}/media/${encodeURIComponent(id)}`,
    { initialParams: { depth: 0 } },
  )
  return !isError && !isLoading && data?.id ? <ImagePreview image={data as Media} /> : null
}
export const OptionValueRowLabel: React.FC<RowLabelProps> = () => {
  const { data, path, rowNumber } = useRowLabel<{
    label?: string
    swatch?: string
    image?: Image | null
  }>()
  const parentPath = path.split('.').slice(0, -2).join('.')
  const display = useFormFields(([fields]) => fields[`${parentPath}.display`]?.value)
  return (
    <span className={styles.label}>
      {display === 'swatch' && data?.swatch && (
        <span
          aria-label={`Color ${data.swatch}`}
          className={styles.swatch}
          style={{ backgroundColor: data.swatch }}
        />
      )}
      {data?.image &&
        (typeof data.image === 'object' ? (
          <ImagePreview image={data.image} />
        ) : (
          <LoadedImage key={data.image} id={data.image} />
        ))}
      {data?.label?.trim() || `Value ${Number(rowNumber ?? 0) + 1}`}
    </span>
  )
}
