import { describe, expect, it, vi } from 'vitest'
import { authenticatedOrPublishedProduct } from '@/access/authenticatedOrPublishedProduct'

describe('Product read access', () => {
  it('gives editors full access and filters anonymous readers by status and publication time', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-10-22T08:00:00.000Z'))
      expect(authenticatedOrPublishedProduct({ req: { user: null } } as never)).toEqual({
        _status: { equals: 'published' },
        publishedAt: { exists: true, less_than_equal: '2026-10-22T08:00:00.000Z' },
      })
      expect(authenticatedOrPublishedProduct({ req: { user: { id: 'editor' } } } as never)).toBe(
        true,
      )
      vi.setSystemTime(new Date('2026-10-23T08:00:00.000Z'))
      expect(authenticatedOrPublishedProduct({ req: { user: null } } as never)).toMatchObject({
        publishedAt: { less_than_equal: '2026-10-23T08:00:00.000Z' },
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
