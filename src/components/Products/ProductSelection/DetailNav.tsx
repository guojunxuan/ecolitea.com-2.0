'use client'
import { AnchorNav } from '../AnchorNav'
import { useProductSelection } from './index'
import type { InquiryButton } from '@/utilities/products/models'
export function ProductDetailNav({
  sections,
  hasRelated,
  action,
}: {
  sections: { id: string; label: string }[]
  hasRelated: boolean
  action?: InquiryButton
}) {
  const { specifications } = useProductSelection()
  return (
    <AnchorNav
      variant="detail"
      action={action}
      items={[
        { id: 'overview', label: 'Overview' },
        ...sections,
        ...(specifications.length ? [{ id: 'specifications', label: 'Specifications' }] : []),
        ...(hasRelated ? [{ id: 'related-products', label: 'Related' }] : []),
      ]}
    />
  )
}
