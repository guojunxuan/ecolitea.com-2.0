import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import fs from 'node:fs'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

import { Search } from '@/search/Component'
import { normalizeSearchQuery } from '@/search/query'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  push.mockClear()
})

describe('Search query navigation', () => {
  it('uses the first query value when Next provides repeated q parameters', () => {
    expect(normalizeSearchQuery(['tea', 'coffee'])).toBe('tea')
    expect(normalizeSearchQuery(['', 'coffee'])).toBe('')
    expect(normalizeSearchQuery(undefined)).toBe('')
  })
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

  it('shows a query from external back or forward navigation without a new push', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Search initialQuery="oolong" />)

    rerender(<Search initialQuery="jasmine" />)
    expect(screen.getByRole('textbox', { name: 'Search' })).toHaveProperty('value', 'jasmine')
    act(() => vi.advanceTimersByTime(250))
    expect(push).not.toHaveBeenCalled()
  })

  it('does not overwrite newer typing when an earlier search response arrives', () => {
    vi.useFakeTimers()
    expect(fs.readFileSync('src/app/(frontend)/search/page.tsx', 'utf8')).not.toContain(
      '<Search key=',
    )
    const { rerender } = render(<Search initialQuery="" />)
    const input = screen.getByRole('textbox', { name: 'Search' })

    fireEvent.change(input, { target: { value: 'tea' } })
    act(() => vi.advanceTimersByTime(250))
    expect(push).toHaveBeenLastCalledWith('/search?q=tea')

    fireEvent.change(input, { target: { value: 'teapot' } })
    rerender(<Search initialQuery="tea" />)
    expect(input).toHaveProperty('value', 'teapot')

    act(() => vi.advanceTimersByTime(250))
    expect(push).toHaveBeenLastCalledWith('/search?q=teapot')
    rerender(<Search initialQuery="teapot" />)
    expect(input).toHaveProperty('value', 'teapot')
  })

  it('ignores a stale own response after a newer response has arrived', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Search initialQuery="" />)
    const input = screen.getByRole('textbox', { name: 'Search' })

    fireEvent.change(input, { target: { value: 'tea' } })
    act(() => vi.advanceTimersByTime(250))
    fireEvent.change(input, { target: { value: 'teapot' } })
    act(() => vi.advanceTimersByTime(250))

    rerender(<Search initialQuery="teapot" />)
    rerender(<Search initialQuery="tea" />)
    expect(input).toHaveProperty('value', 'teapot')
  })

  it('syncs browser Back before an in-flight response arrives', () => {
    vi.useFakeTimers()
    const { rerender } = render(<Search initialQuery="" />)
    const input = screen.getByRole('textbox', { name: 'Search' })

    fireEvent.change(input, { target: { value: 'tea' } })
    act(() => vi.advanceTimersByTime(250))
    act(() => window.dispatchEvent(new PopStateEvent('popstate')))
    expect(input).toHaveProperty('value', '')

    rerender(<Search initialQuery="tea" />)
    expect(input).toHaveProperty('value', '')
  })
})
