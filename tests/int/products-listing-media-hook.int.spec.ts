import { NotFound } from 'payload'
import { expect, it, vi } from 'vitest'
import { validateProductListingMedia } from '@/Settings/hooks/validateProductListingMedia'

it('reports a missing retained slide upload as a field error', async () => {
  const findByID = vi.fn(async ({ disableErrors }) => {
    if (disableErrors) return null
    throw new NotFound()
  })
  await expect(
    validateProductListingMedia({
      data: { blog: { seo: { title: 'Updated' } } },
      originalDoc: { product: { heroSlides: [{ media: 'deleted' }] } },
      req: { payload: { findByID } },
    } as never),
  ).rejects.toMatchObject({
    status: 400,
    data: { errors: [{ path: 'product.heroSlides.0.media' }] },
  })
})

it.each(['media', 'mobileMedia'])(
  'rejects API-supplied unsupported %s using stored metadata and indexed paths',
  async (field) => {
    const findByID = vi.fn().mockResolvedValue({ mimeType: 'application/pdf' })
    await expect(
      validateProductListingMedia({
        data: { product: { heroSlides: [{ [field]: { id: 'bad', mimeType: 'image/jpeg' } }] } },
        req: { payload: { findByID } },
      } as never),
    ).rejects.toMatchObject({
      status: 400,
      data: { errors: [{ path: `product.heroSlides.0.${field}` }] },
    })
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 'bad', depth: 0 }),
    )
  },
)
it('validates retained slides on partial writes, preserves inactive data, and accepts MP4/images', async () => {
  const findByID = vi
    .fn()
    .mockImplementation(({ id }) =>
      Promise.resolve({ mimeType: id === 'video' ? 'video/mp4' : 'image/png' }),
    )
  const originalDoc = {
    product: {
      heroSlides: [
        { media: 'image', mobileMedia: 'video', enableCta: false, cta: { label: 'Kept' } },
      ],
    },
  }
  const data = { blog: { seo: { title: 'Keep' } } }
  expect(
    await validateProductListingMedia({
      data,
      originalDoc,
      req: { payload: { findByID } },
    } as never),
  ).toBe(data)
  expect(findByID).toHaveBeenCalledTimes(2)
  expect(originalDoc.product.heroSlides[0].cta.label).toBe('Kept')
  findByID.mockClear()
  await validateProductListingMedia({
    data: { product: { heroSlides: [] } },
    originalDoc,
    req: { payload: { findByID } },
  } as never)
  expect(findByID).not.toHaveBeenCalled()
})
