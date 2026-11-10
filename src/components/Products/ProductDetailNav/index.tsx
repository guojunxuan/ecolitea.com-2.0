import { AnchorNav } from '../AnchorNav'

export function ProductDetailNav({
  sections,
  hasRelated,
}: {
  sections: { id: string; label: string }[]
  hasRelated: boolean
}) {
  return (
    <AnchorNav
      variant="detail"
      items={[
        { id: 'overview', label: 'Overview' },
        ...sections,
        ...(hasRelated ? [{ id: 'related-products', label: 'Related' }] : []),
      ]}
    />
  )
}
