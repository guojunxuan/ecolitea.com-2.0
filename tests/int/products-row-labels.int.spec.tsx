import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: { data: {} as Record<string, unknown>, rowNumber: undefined as number | undefined },
}))
vi.mock('@payloadcms/ui', () => ({ useRowLabel: () => state.row }))

const modules = import.meta.glob('/src/collections/Products/admin/*RowLabel.tsx', {
  eager: true,
}) as Record<string, Record<string, React.ComponentType>>

afterEach(cleanup)

describe('Product array row labels', () => {
  it('shows current highlight text and a numbered fallback for unnamed rows', () => {
    const Label =
      modules['/src/collections/Products/admin/HighlightRowLabel.tsx']?.HighlightRowLabel
    expect(Label).toBeDefined()
    state.row = { data: { text: '  Organic tea  ' }, rowNumber: 0 }
    const { rerender } = render(<Label />)
    expect(screen.getByText('Organic tea')).toBeTruthy()
    state.row = { data: { text: '   ' }, rowNumber: 2 }
    rerender(<Label />)
    expect(screen.getByText('Highlight 3')).toBeTruthy()
    state.row = { data: {}, rowNumber: undefined }
    rerender(<Label />)
    expect(screen.getByText('Highlight 1')).toBeTruthy()
  })

  it('shows specification label and value without requiring a group', () => {
    const Label =
      modules['/src/collections/Products/admin/SpecificationRowLabel.tsx']?.SpecificationRowLabel
    expect(Label).toBeDefined()
    state.row = { data: { label: ' Origin ', value: ' China ' }, rowNumber: 0 }
    const { rerender } = render(<Label />)
    expect(screen.getByText('Origin: China')).toBeTruthy()
    state.row.data = { label: 'Origin' }
    rerender(<Label />)
    expect(screen.getByText('Origin')).toBeTruthy()
    state.row.data = { value: 'China' }
    rerender(<Label />)
    expect(screen.getByText('China')).toBeTruthy()
    state.row = { data: { label: ' ', value: null }, rowNumber: 1 }
    rerender(<Label />)
    expect(screen.getByText('Specification 2')).toBeTruthy()
    state.row = { data: {}, rowNumber: undefined }
    rerender(<Label />)
    expect(screen.getByText('Specification 1')).toBeTruthy()
  })
})
