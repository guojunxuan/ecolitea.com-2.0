import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ProductDetail } from '@/utilities/products/models'
import {
  ProductSelectionProvider,
  useProductSelection,
} from '@/components/Products/ProductSelection'
import { ProductOptions } from '@/components/Products/ProductOptions'
import { ProductSpecifications } from '@/components/Products/ProductSpecifications'
vi.mock('@/components/Media', () => ({ Media: () => <span data-testid="media" /> }))
const product = {
  defaultSelection: { color: 'white', size: 'small' },
  options: [
    {
      key: 'color',
      name: 'Color',
      display: 'swatch',
      values: [
        { key: 'white', label: 'White', swatch: '#ffffff', image: null, specifications: [] },
        {
          key: 'black',
          label: 'Black',
          swatch: '#000000',
          image: { id: 'black' },
          specifications: [{ label: 'Finish', value: 'Black' }],
        },
      ],
    },
    {
      key: 'size',
      name: 'Size',
      display: 'text',
      values: [
        { key: 'small', label: 'Small', image: null, specifications: [] },
        {
          key: 'large',
          label: 'Large',
          image: null,
          specifications: [{ label: 'Width', value: 'Large' }],
        },
      ],
    },
  ],
  specifications: [
    { label: 'Finish', value: 'White' },
    { label: 'Width', value: 'Small' },
  ],
  gallery: [
    { media: { id: 'base' }, values: [] },
    { media: { id: 'black' }, values: [{ optionKey: 'color', valueKey: 'black' }] },
  ],
} as unknown as ProductDetail
const Probe = () => {
  const { selection, activeImageIndex, selectImage } = useProductSelection()
  return (
    <>
      <output>{JSON.stringify({ selection, activeImageIndex })}</output>
      <button onClick={() => selectImage(0)}>Base image</button>
      <button onClick={() => selectImage(1)}>Black image</button>
    </>
  )
}
function show(p = product) {
  return render(
    <ProductSelectionProvider product={p}>
      <ProductOptions />
      <ProductSpecifications />
      <Probe />
    </ProductSelectionProvider>,
  )
}
beforeEach(() => window.history.replaceState({}, '', '/products/tea/bag'))
afterEach(cleanup)
describe('Product selection islands', () => {
  it('hydrates URL selection with unknown values falling back to defaults', async () => {
    window.history.replaceState({}, '', '?color=black&size=unknown&utm=kept')
    show()
    await waitFor(() =>
      expect(screen.getByRole('radio', { name: 'Black' }).getAttribute('aria-checked')).toBe(
        'true',
      ),
    )
    expect(screen.getByRole('radio', { name: 'Small' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByText('Black', { selector: 'dd' })).toBeTruthy()
  })
  it('updates selection, image and specs, preserving the image when a value has no image', () => {
    const replace = vi.spyOn(window.history, 'replaceState')
    show()
    fireEvent.click(screen.getByRole('radio', { name: 'Black' }))
    expect(screen.getByRole('status').textContent).toContain('"activeImageIndex":1')
    fireEvent.click(screen.getByRole('radio', { name: 'Large' }))
    expect(screen.getByRole('status').textContent).toContain('"activeImageIndex":1')
    expect(screen.getByText('Large', { selector: 'dd' })).toBeTruthy()
    expect(replace).toHaveBeenCalled()
    expect(window.location.search).toContain('size=large')
    replace.mockRestore()
  })
  it('reverse-selects value images while product-only images preserve selection', () => {
    show()
    fireEvent.click(screen.getByText('Black image'))
    expect(screen.getByRole('radio', { name: 'Black' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(screen.getByText('Base image'))
    expect(screen.getByRole('radio', { name: 'Black' }).getAttribute('aria-checked')).toBe('true')
  })
  it('supports radio arrow keys and keeps focus on selected value', () => {
    show()
    const white = screen.getByRole('radio', { name: 'White' })
    white.focus()
    fireEvent.keyDown(white, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Black' }))
    expect(screen.getByRole('radio', { name: 'Black' }).getAttribute('aria-checked')).toBe('true')
  })
  it('folds specifications after twelve rows and expands without changing URL', () => {
    show({
      ...product,
      specifications: Array.from({ length: 14 }, (_, i) => ({
        label: `Spec ${i}`,
        value: String(i),
      })),
    })
    expect(screen.queryByText('Spec 13')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show all specifications' }))
    expect(screen.getByText('Spec 13')).toBeTruthy()
    expect(window.location.search).toBe('')
  })
})

it('canonicalizes option query aliases so a shared URL survives refresh', () => {
  window.history.replaceState({}, '', '?color=white&Color=black&utm=kept')
  show()
  fireEvent.click(screen.getByRole('radio', { name: 'White' }))
  expect(window.location.search).toContain('color=white')
  expect(window.location.search).not.toContain('Color=')
  expect(window.location.search).toContain('utm=kept')
})

it('realigns the active gallery slide when resizing from desktop to mobile', async () => {
  const { ProductGallery } = await import('@/components/Products/ProductGallery')
  let desktop = true
  const listeners: (() => void)[] = []
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return desktop
    },
    addEventListener: (_name: string, fn: () => void) => listeners.push(fn),
    removeEventListener: () => {},
  }))
  const scroll = vi.fn()
  HTMLElement.prototype.scrollTo = scroll
  render(
    <ProductSelectionProvider product={product}>
      <ProductGallery />
    </ProductSelectionProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: 'Show image 2 of 2' }))
  const track = screen.getByRole('region', { name: 'Product images' })
  Object.defineProperty(track, 'clientWidth', { value: 375, configurable: true })
  desktop = false
  const { act } = await import('@testing-library/react')
  act(() => listeners.forEach((listener) => listener()))
  expect(scroll).toHaveBeenLastCalledWith({ left: 375, behavior: 'auto' })
  vi.unstubAllGlobals()
})
