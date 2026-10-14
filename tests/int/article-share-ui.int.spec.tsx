import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ArticleShare } from '@/components/ArticleShare'
import { CopyLink } from '@/components/ArticleShare/CopyLink'

const url = 'https://example.test/blogs/tea'
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
describe('article sharing controls', () => {
  it('renders accessible SVG platform links with the correct browsing behavior', () => {
    const icon = { src: '/share.svg', alt: 'Share', width: 20, height: 20 }
    render(
      <ArticleShare
        model={{
          links: [
            { name: 'Network', href: 'https://example.test/share', icon },
            { name: 'Email', href: '  MAILTO:?subject=Tea', icon },
          ],
          copyLink: false,
        }}
        url={url}
      />,
    )
    const web = screen.getByRole('link', { name: 'Share on Network' })
    expect(web.getAttribute('target')).toBe('_blank')
    expect(web.getAttribute('rel')).toBe('noopener noreferrer')
    expect(web.querySelector('img')?.getAttribute('src')).toBe('/share.svg')
    expect(screen.getByRole('link', { name: 'Share on Email' }).hasAttribute('target')).toBe(false)
    expect(screen.getByRole('link', { name: 'Share on Email' }).getAttribute('href')).toBe(
      '  MAILTO:?subject=Tea',
    )
    expect(screen.queryByRole('button')).toBeNull()
  })
  it('hides an empty disabled share region and permits copy alone', () => {
    const { rerender, container } = render(
      <ArticleShare model={{ links: [], copyLink: false }} url={url} />,
    )
    expect(container.innerHTML).toBe('')
    rerender(<ArticleShare model={{ links: [], copyLink: true }} url={url} />)
    expect(screen.getByRole('button', { name: 'Copy link' })).toBeTruthy()
  })
  it.each([true, false])(
    'announces clipboard result %s and clears it after two seconds',
    async (success) => {
      vi.useFakeTimers()
      const writeText = success
        ? vi.fn().mockResolvedValue(undefined)
        : vi.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
      render(<CopyLink url={url} />)
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
      })
      expect(writeText).toHaveBeenCalledWith(url)
      expect(screen.getByRole('status').textContent).toBe(success ? 'Link copied' : 'Copy failed')
      act(() => vi.advanceTimersByTime(1999))
      expect(screen.getByRole('status').textContent).not.toBe('')
      act(() => vi.advanceTimersByTime(1))
      expect(screen.getByRole('status').textContent).toBe('')
    },
  )
  it('cleans up the feedback timer on unmount', async () => {
    vi.useFakeTimers()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
    const { unmount } = render(<CopyLink url={url} />)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Copy link' }))
    })
    expect(vi.getTimerCount()).toBe(1)
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
