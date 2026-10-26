import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MobileInquiryBar } from '@/components/Products/MobileInquiryBar'
import {
  ProductSelectionProvider,
  useProductSelection,
} from '@/components/Products/ProductSelection'
import { ProductDetailNav } from '@/components/Products/ProductSelection/DetailNav'
import type { ProductDetail } from '@/utilities/products/models'
vi.mock('@/components/Products/AnchorNav', () => ({
  AnchorNav: ({ items }: { items: { id: string; label: string }[] }) => (
    <nav>
      {items.map((item) => (
        <a href={`#${item.id}`} key={item.id}>
          {item.label}
        </a>
      ))}
    </nav>
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
describe('Product detail navigation boundaries', () => {
  it('adds Specifications to the anchor nav when selected values introduce the only specs', () => {
    const product = {
      defaultSelection: { color: 'white' },
      specifications: [],
      gallery: [],
      options: [
        {
          key: 'color',
          values: [
            { key: 'white', image: null, specifications: [] },
            { key: 'black', image: null, specifications: [{ label: 'Finish', value: 'Black' }] },
          ],
        },
      ],
    } as unknown as ProductDetail
    const Change = () => {
      const { selectValue } = useProductSelection()
      return <button onClick={() => selectValue('color', 'black')}>Select black</button>
    }
    render(
      <ProductSelectionProvider product={product}>
        <ProductDetailNav sections={[]} hasRelated={false} />
        <Change />
      </ProductSelectionProvider>,
    )
    expect(screen.queryByRole('link', { name: 'Specifications' })).toBeNull()
    fireEvent.click(screen.getByText('Select black'))
    expect(screen.getByRole('link', { name: 'Specifications' }).getAttribute('href')).toBe(
      '#specifications',
    )
  })
  it('only shows mobile inquiry after passing header actions and hides it at the footer', () => {
    const observers: { callback: IntersectionObserverCallback; target?: Element }[] = []
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        item: { callback: IntersectionObserverCallback; target?: Element }
        constructor(callback: IntersectionObserverCallback) {
          this.item = { callback }
          observers.push(this.item)
        }
        observe(target: Element) {
          this.item.target = target
        }
        disconnect() {}
      },
    )
    render(
      <>
        <div id="inquiry">Header inquiry</div>
        <MobileInquiryBar action={{ type: 'custom', url: '/contact', label: 'Contact' }} />
        <footer>Footer</footer>
      </>,
    )
    const header = observers.find((item) => item.target?.id === 'inquiry')!
    const footer = observers.find((item) => item.target?.tagName === 'FOOTER')!
    const notify = (observer: typeof header, visible: boolean, bottom: number) =>
      act(() =>
        observer.callback(
          [
            {
              isIntersecting: visible,
              boundingClientRect: { bottom },
            } as IntersectionObserverEntry,
          ],
          {} as IntersectionObserver,
        ),
      )
    notify(header, false, 900)
    expect(screen.queryByRole('link', { name: 'Contact' })).toBeNull()
    notify(header, false, -1)
    expect(screen.getByRole('link', { name: 'Contact' })).toBeTruthy()
    notify(footer, true, 900)
    expect(screen.queryByRole('link', { name: 'Contact' })).toBeNull()
    notify(footer, false, 1000)
    notify(header, true, 100)
    expect(screen.queryByRole('link', { name: 'Contact' })).toBeNull()
  })
})
