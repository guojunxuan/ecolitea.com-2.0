import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpecificationGroupRowLabel } from '@/collections/Products/admin/SpecificationGroupRowLabel'
import { SpecificationRowLabel } from '@/collections/Products/admin/SpecificationRowLabel'
import { SectionRowLabel } from '@/collections/Products/admin/SectionRowLabel'

const state = vi.hoisted(() => ({
  row: { data: {} as Record<string, unknown>, rowNumber: undefined as number | undefined },
}))
vi.mock('@payloadcms/ui', () => ({ useRowLabel: () => state.row }))

afterEach(cleanup)

describe('Product Section row labels', () => {
  it('keeps the navigation label primary and shows the anchor and zero Block count', () => {
    state.row = {
      data: {
        label: '  Brewing  ',
        title: 'A different chapter title',
        anchor: 'brewing',
        blocks: [],
      },
      rowNumber: 0,
    }
    const { rerender } = render(<SectionRowLabel path="sections.0" />)
    expect(screen.getByText('Brewing')).toBeTruthy()
    expect(screen.getByText('#brewing · 0 blocks')).toBeTruthy()
    expect(screen.queryByText('A different chapter title')).toBeNull()
    state.row.data = {
      title: 'A title without a navigation label',
      anchor: 'brewing',
      blocks: [{}],
    }
    rerender(<SectionRowLabel path="sections.0" />)
    expect(screen.getByText('Section 1')).toBeTruthy()
    expect(screen.getByText('#brewing · 1 blocks')).toBeTruthy()
  })
})

describe('Product specification row labels', () => {
  it('uses the group name or counts rows for an unnamed group', () => {
    state.row.data = { group: '  Construction  ', items: [{}, {}] }
    const { rerender } = render(<SpecificationGroupRowLabel path="specifications.0" />)
    expect(screen.getByText('Construction')).toBeTruthy()
    state.row.data = { group: ' ', items: [{}, {}] }
    rerender(<SpecificationGroupRowLabel path="specifications.0" />)
    expect(screen.getByText('Ungrouped · 2 rows')).toBeTruthy()
  })

  it('shows specification label and value without requiring a group', () => {
    state.row = {
      data: { label: ' Origin ', value: ' China ' },
      rowNumber: 0,
    }
    const { rerender } = render(<SpecificationRowLabel path="specifications.0.items.0" />)
    expect(screen.getByText('Origin: China')).toBeTruthy()
    state.row.data = { label: 'Origin' }
    rerender(<SpecificationRowLabel path="specifications.0.items.0" />)
    expect(screen.getByText('Origin')).toBeTruthy()
    state.row.data = { value: 'China' }
    rerender(<SpecificationRowLabel path="specifications.0.items.0" />)
    expect(screen.getByText('China')).toBeTruthy()
    state.row = { data: { label: ' ', value: null }, rowNumber: 1 }
    rerender(<SpecificationRowLabel path="specifications.0.items.0" />)
    expect(screen.getByText('Specification 2')).toBeTruthy()
    state.row = { data: {}, rowNumber: undefined }
    rerender(<SpecificationRowLabel path="specifications.0.items.0" />)
    expect(screen.getByText('Specification 1')).toBeTruthy()
  })
})
