import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const rowState = vi.hoisted(() => ({
  data: undefined as Record<string, unknown> | undefined,
  rowNumber: undefined as number | undefined,
}))

vi.mock('@payloadcms/ui', () => ({
  useRowLabel: () => rowState,
}))

import { DropdownItemRowLabel } from '@/Header/DropdownItemRowLabel'
import { RowLabel } from '@/Header/RowLabel'

afterEach(() => {
  cleanup()
  rowState.data = undefined
  rowState.rowNumber = undefined
})

describe('Header admin row labels', () => {
  it('summarizes a navigation item with its trimmed label and readable type', () => {
    rowState.rowNumber = 0
    rowState.data = { label: ' Products ', navigationType: 'directLinkAndDropdown' }

    render(<RowLabel path="navItems.0" />)

    expect(screen.getByText('Navigation Item 1: Products · Direct Link + Dropdown')).toBeTruthy()
  })

  it('uses a deterministic navigation item fallback for missing row data', () => {
    render(<RowLabel path="navItems" />)

    expect(screen.getByText('Navigation Item')).toBeTruthy()
  })

  it('keeps the readable navigation type when its label is blank', () => {
    rowState.rowNumber = 1
    rowState.data = { label: '   ', navigationType: 'dropdown' }

    render(<RowLabel path="navItems.1" />)

    expect(screen.getByText('Navigation Item 2 · Dropdown')).toBeTruthy()
  })

  it.each([
    [
      'default',
      {
        defaultItem: { link: { label: ' Default Label ' } },
        featuredItem: { tag: 'Stale Featured' },
      },
      'Default Label · Default',
    ],
    [
      'featured',
      {
        defaultItem: { link: { label: 'Stale Default' } },
        featuredItem: { tag: ' Featured Tag ' },
      },
      'Featured Tag · Featured',
    ],
    [
      'list',
      {
        defaultItem: { link: { label: 'Stale Default' } },
        featuredItem: { tag: 'Stale Featured' },
        listItem: { tag: ' List Tag ' },
      },
      'List Tag · List',
    ],
  ])('summarizes only the active %s dropdown branch', (type, branches, summary) => {
    rowState.rowNumber = 0
    rowState.data = { type, ...branches }

    render(<DropdownItemRowLabel path="items.0" />)

    expect(screen.getByText(`Dropdown Item 1: ${summary}`)).toBeTruthy()
  })

  it('uses a numbered dropdown fallback while retaining its readable type', () => {
    rowState.rowNumber = 2
    rowState.data = { featuredItem: { tag: '   ' }, type: 'featured' }

    render(<DropdownItemRowLabel path="items.2" />)

    expect(screen.getByText('Dropdown Item 3 · Featured')).toBeTruthy()
  })

  it('handles an undefined dropdown row safely', () => {
    render(<DropdownItemRowLabel path="items" />)

    expect(screen.getByText('Dropdown Item')).toBeTruthy()
  })
})
