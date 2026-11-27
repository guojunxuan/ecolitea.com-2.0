import { describe, expect, it, vi } from 'vitest'

const { revalidateTag } = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock('next/cache', () => ({ revalidateTag }))

import { revalidateRedirects } from '@/hooks/revalidateRedirects'

describe('redirect revalidation', () => {
  it('skips cache revalidation for isolated fixture writes', () => {
    const doc = { id: 'redirect-1' }
    const result = revalidateRedirects({
      doc,
      req: { context: { disableRevalidate: true }, payload: { logger: { info: vi.fn() } } },
    } as never)
    expect(result).toBe(doc)
    expect(revalidateTag).not.toHaveBeenCalled()
  })

  it('revalidates normal redirect writes', () => {
    revalidateTag.mockClear()
    revalidateRedirects({
      doc: { id: 'redirect-2' },
      req: { context: {}, payload: { logger: { info: vi.fn() } } },
    } as never)
    expect(revalidateTag).toHaveBeenCalledWith('redirects', 'max')
  })
})
