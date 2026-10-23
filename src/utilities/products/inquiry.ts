import type { Product, Settings } from '@/payload-types'
import type { InquiryButton } from './models'

export const resolveProductInquiry = (
  product: Pick<Product, 'inquiry'>,
  settings?: Pick<Settings, 'product'> | null,
): { buttons: InquiryButton[] } => {
  if (product.inquiry?.mode === 'hidden') return { buttons: [] }
  const rows =
    product.inquiry?.mode === 'custom'
      ? product.inquiry.buttons
      : settings?.product?.inquiry?.buttons
  return {
    buttons: (rows ?? []).map(({ link }) => ({
      type: link.type,
      reference: link.reference,
      url: link.url,
      label: link.label,
      newTab: link.newTab,
      appearance: link.appearance ?? 'default',
    })),
  }
}
