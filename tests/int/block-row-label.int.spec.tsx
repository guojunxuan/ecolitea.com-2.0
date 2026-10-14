import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  row: {
    data: {} as Record<string, unknown>,
    path: '',
    rowNumber: undefined as number | undefined,
  },
  sibling: {} as Record<string, unknown>,
}))
vi.mock('@payloadcms/ui', () => ({
  useRowLabel: () => state.row,
  useWatchForm: () => ({ getSiblingData: () => state.sibling }),
}))
const modules = import.meta.glob('/src/blocks/BlockRowLabel.tsx', { eager: true }) as Record<
  string,
  { BlockRowLabel: React.ComponentType<{ path?: string; blockType?: string }> }
>
afterEach(cleanup)

describe('editorial block row labels', () => {
  it('shows current block heading in a collection row', () => {
    const Label = modules['/src/blocks/BlockRowLabel.tsx']?.BlockRowLabel
    expect(Label).toBeDefined()
    state.row = {
      data: { blockType: 'cta', heading: 'Explore tea' },
      path: 'layout.0',
      rowNumber: 0,
    }
    const { rerender } = render(<Label />)
    expect(screen.getByText('Action Card: Explore tea')).toBeTruthy()
    state.row.data = {
      blockType: 'keyTakeaways',
      label: 'Opening paragraph',
    }
    rerender(<Label />)
    expect(screen.getByText('Key Points: Opening paragraph')).toBeTruthy()
  })

  it('uses the embedded Lexical form when no collection row context exists', () => {
    const Label = modules['/src/blocks/BlockRowLabel.tsx']?.BlockRowLabel
    expect(Label).toBeDefined()
    state.row = { data: {}, path: '', rowNumber: undefined }
    state.sibling = { title: 'A useful note' }
    render(<Label path="_components" blockType="banner" />)
    expect(screen.getByText('Notice: A useful note')).toBeTruthy()
  })
})
