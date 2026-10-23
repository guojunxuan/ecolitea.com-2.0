import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: {
    data: {} as Record<string, unknown>,
    rowNumber: undefined as number | undefined,
    path: 'options.1.values.0',
  },
}))
vi.mock('@payloadcms/ui', () => ({
  useRowLabel: () => state.row,
  useFormFields: (selector: (value: unknown) => unknown) =>
    selector([{ 'options.1.display': { value: state.row.data.display } }]),
}))

const modules = import.meta.glob('/src/collections/Products/admin/*RowLabel.tsx', {
  eager: true,
}) as Record<string, Record<string, React.ComponentType>>

afterEach(cleanup)

describe('Product array row labels', () => {
  it('shows current highlight text and a numbered fallback for unnamed rows', () => {
    const Label =
      modules['/src/collections/Products/admin/HighlightRowLabel.tsx']?.HighlightRowLabel
    expect(Label).toBeDefined()
    state.row = { data: { text: '  Organic tea  ' }, rowNumber: 0, path: 'options.1.values.0' }
    const { rerender } = render(<Label />)
    expect(screen.getByText('Organic tea')).toBeTruthy()
    state.row = { data: { text: '   ' }, rowNumber: 2, path: 'options.1.values.0' }
    rerender(<Label />)
    expect(screen.getByText('Highlight 3')).toBeTruthy()
    state.row = { data: {}, rowNumber: undefined, path: 'options.1.values.0' }
    rerender(<Label />)
    expect(screen.getByText('Highlight 1')).toBeTruthy()
  })

  it('shows specification label and value without requiring a group', () => {
    const Label =
      modules['/src/collections/Products/admin/SpecificationRowLabel.tsx']?.SpecificationRowLabel
    expect(Label).toBeDefined()
    state.row = {
      data: { label: ' Origin ', value: ' China ' },
      rowNumber: 0,
      path: 'options.1.values.0',
    }
    const { rerender } = render(<Label />)
    expect(screen.getByText('Origin: China')).toBeTruthy()
    state.row.data = { label: 'Origin' }
    rerender(<Label />)
    expect(screen.getByText('Origin')).toBeTruthy()
    state.row.data = { value: 'China' }
    rerender(<Label />)
    expect(screen.getByText('China')).toBeTruthy()
    state.row = { data: { label: ' ', value: null }, rowNumber: 1, path: 'options.1.values.0' }
    rerender(<Label />)
    expect(screen.getByText('Specification 2')).toBeTruthy()
    state.row = { data: {}, rowNumber: undefined, path: 'options.1.values.0' }
    rerender(<Label />)
    expect(screen.getByText('Specification 1')).toBeTruthy()
  })
})

it('shows option summary and uses the actual parent display for swatch values', () => {
  const GroupLabel = modules['/src/collections/Products/admin/OptionRowLabel.tsx']?.OptionRowLabel
  state.row.data = { name: ' Color ', display: 'swatch', values: [{ label: 'Red' }] }
  const { unmount } = render(<GroupLabel />)
  expect(screen.getByText('Color')).toBeTruthy()
  expect(screen.getByText('swatch · 1 values')).toBeTruthy()
  unmount()
  const ValueLabel =
    modules['/src/collections/Products/admin/OptionValueRowLabel.tsx']?.OptionValueRowLabel
  state.row.data = { label: 'Red', swatch: '#f00', display: 'swatch' }
  const { rerender } = render(<ValueLabel />)
  expect(screen.getByLabelText('Color #f00')).toBeTruthy()
  state.row.data.display = 'text'
  rerender(<ValueLabel />)
  expect(screen.queryByLabelText('Color #f00')).toBeNull()
  state.row.data.display = 'image'
  rerender(<ValueLabel />)
  expect(screen.queryByLabelText('Color #f00')).toBeNull()
})
