import { DOCUMENT_UPLOAD_POLICY } from '@/collections/Documents/uploadPolicy'
import { QuoteRequestDialog } from '@/components/Products/QuoteRequest/QuoteRequestDialog'
import type { ProductDownload } from '@/utilities/products/models'

import { DownloadDialog } from './DownloadDialog'
import styles from './index.module.css'

const fileSizeFormat = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
const documentTypes = Object.entries(DOCUMENT_UPLOAD_POLICY.types)

function describeDownload({ url, mimeType, filesize }: ProductDownload) {
  const filename = url.split(/[?#]/, 1)[0].split('/').at(-1)
  const extension =
    documentTypes.find(([, type]) => type.mimeType === mimeType)?.[0] ??
    filename?.match(/\.([a-z\d]{2,8})$/i)?.[1]
  const fileType = extension?.toUpperCase()
  if (filesize == null || !Number.isFinite(filesize) || filesize < 0) return fileType
  const [value, unit] =
    filesize >= 1_000_000
      ? [filesize / 1_000_000, 'MB']
      : filesize >= 1_000
        ? [filesize / 1_000, 'KB']
        : [filesize, 'B']
  return [fileType, `${fileSizeFormat.format(value)} ${unit}`].filter(Boolean).join(' · ')
}

export function ProductActions({
  downloads,
  product,
}: {
  downloads: ProductDownload[]
  product: { title: string; slug: string }
}) {
  return (
    <div className={styles.actions}>
      <QuoteRequestDialog product={product} />
      {downloads.length > 0 && (
        <DownloadDialog
          files={downloads.map((file) => ({
            id: file.id,
            title: file.title,
            url: file.url,
            meta: describeDownload(file),
          }))}
        />
      )}
    </div>
  )
}
