import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SpecificationGroupRowLabel } from '@/collections/Products/admin/SpecificationGroupRowLabel'
import { SpecificationRowLabel } from '@/collections/Products/admin/SpecificationRowLabel'

const state = vi.hoisted(() => ({
  row: { data: {} as Record<string, unknown>, rowNumber: undefined as number | undefined },
}))
vi.mock('@payloadcms/ui', () => ({ useRowLabel: () => state.row }))

afterEach(cleanup)

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
