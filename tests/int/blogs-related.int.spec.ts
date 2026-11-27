import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import type { Blog } from '@/payload-types'
import { getRelatedBlogs } from '@/utilities/blogs/getRelatedBlogs'

const now = new Date('2026-10-02T12:00:00.000Z')
const blog = (id: string, category = 'cat'): Blog =>
  ({ id, category, relatedBlogs: [] }) as unknown as Blog

describe('related blog selection', () => {
  it('preserves valid manual order, then fills same category and site-wide to three', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [blog('manual-b'), blog('manual-a')] })
      .mockResolvedValueOnce({ docs: [blog('same')] })
    const source = {
      ...blog('self'),
      relatedBlogs: ['manual-a', 'manual-b', 'manual-a', 'self', '', 42],
    } as unknown as Blog

    const result = await getRelatedBlogs(source, { find } as unknown as Payload, now)

    expect(result.map(({ id }) => id)).toEqual(['manual-a', 'manual-b', 'same'])
    expect(find).toHaveBeenCalledTimes(2)
    for (const [options] of find.mock.calls) {
      expect(options.where.and).toContainEqual({
        _status: { equals: 'published' },
        publishedAt: { less_than_equal: now.toISOString() },
      })
    }
    expect(find.mock.calls[0][0].where.and).toContainEqual({ id: { not_in: ['self'] } })
    expect(find.mock.calls[1][0].where.and).toContainEqual({
      id: { not_in: ['self', 'manual-a', 'manual-b'] },
    })
    expect(find.mock.calls[1][0].where.and).toContainEqual({ category: { equals: 'cat' } })
  })

  it('rejects stale manual snapshots and fills with public category then public site results', async () => {
    const find = vi
      .fn()
      .mockResolvedValueOnce({ docs: [blog('good')] })
      .mockResolvedValueOnce({ docs: [blog('same')] })
      .mockResolvedValueOnce({ docs: [blog('site', 'elsewhere')] })
    const source = {
      ...blog('self'),
      relatedBlogs: [
        { ...blog('draft'), _status: 'draft' },
        { ...blog('future'), publishedAt: '2030-01-01T00:00:00.000Z' },
        blog('good'),
      ],
    } as unknown as Blog

    const result = await getRelatedBlogs(source, { find } as unknown as Payload, now)

    expect(result.map(({ id }) => id)).toEqual(['good', 'same', 'site'])
    expect(find.mock.calls[0][0].where.and).toContainEqual({
      id: { in: ['draft', 'future', 'good'] },
    })
    expect(find.mock.calls[2][0].where.and).toContainEqual({
      id: { not_in: ['self', 'good', 'same'] },
    })
  })

  it('returns an empty array when nothing is eligible', async () => {
    const find = vi.fn().mockResolvedValue({ docs: [] })
    await expect(
      getRelatedBlogs(blog('self'), { find } as unknown as Payload, now),
    ).resolves.toEqual([])
    expect(find).toHaveBeenCalledTimes(2)
  })
})
