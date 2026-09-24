import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { Search } from '@/search/Component'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  push.mockClear()
})

describe('Search query navigation', () => {
  it('keeps a deep-linked query in the field without navigating on mount', () => {
    vi.useFakeTimers()
    render(<Search initialQuery="oolong tea" />)

    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveProperty('value', 'oolong tea')
    act(() => vi.advanceTimersByTime(250))
    expect(push).not.toHaveBeenCalled()
  })

  it('navigates only after edits, encoding a new query and allowing a deliberate clear', () => {
    vi.useFakeTimers()
    render(<Search initialQuery="oolong tea" />)
    const input = screen.getByRole('textbox', { name: 'Search' })

    fireEvent.change(input, { target: { value: 'green & black' } })
    act(() => vi.advanceTimersByTime(250))
    expect(push).toHaveBeenLastCalledWith('/search?q=green%20%26%20black')

    fireEvent.change(input, { target: { value: '' } })
    act(() => vi.advanceTimersByTime(250))
    expect(push).toHaveBeenLastCalledWith('/search')
  })

  it('shows the new URL query after navigation changes the server-provided value', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Search key="oolong" initialQuery="oolong" />)

    rerender(<Search key="jasmine" initialQuery="jasmine" />)
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveProperty('value', 'jasmine')
    act(() => vi.advanceTimersByTime(250))
    expect(push).not.toHaveBeenCalled()
  })
})
