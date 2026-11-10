import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ProductDetailNav } from '@/components/Products/ProductDetailNav'

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

afterEach(cleanup)

describe('Product detail navigation boundaries', () => {
  it('links to Overview, detail sections and Related without a separate specifications anchor', () => {
    render(<ProductDetailNav sections={[{ id: 'materials', label: 'Materials' }]} hasRelated />)
    expect(screen.getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '#overview',
      '#materials',
      '#related-products',
    ])
  })
})
