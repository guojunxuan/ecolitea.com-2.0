import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ProductActions } from '@/components/Products/ProductActions'
import { FormBlock, type FormBlockType } from '@/collections/Pages/blocks/Form/Component'
import { ContactList } from '@/Footer/ContactList'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

beforeEach(() => {
  window.dataLayer = []
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new Event('close'))
  }
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.dataLayer
  document.documentElement.style.overflow = ''
})

const form = {
  id: 'wholesale-form',
  title: 'Wholesale inquiry',
  submitButtonLabel: 'Submit inquiry',
  confirmationType: 'redirect',
  redirect: { url: '/thanks' },
  fields: [{ blockType: 'text', name: 'name', label: 'Name', required: true }],
} as FormBlockType['form']

describe('business action events', () => {
  it('tracks a successful CMS form submission with only its configured title', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ doc: { id: 'saved' } }, { status: 201 })),
    )
    render(<FormBlock enableIntro={false} form={form} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit inquiry' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith('/thanks'))
    expect(window.dataLayer).toEqual([{ event: 'form_submit', form_title: 'Wholesale inquiry' }])
  })

  it.each([302, 400])('does not track CMS form submissions with HTTP status %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ errors: [{ message: 'Try again' }] }, { status })),
    )
    render(<FormBlock enableIntro={false} form={form} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
      target: { value: 'Ada Lovelace' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit inquiry' }))
    await screen.findByRole('alert')
    expect(window.dataLayer).toEqual([])
  })

  it('tracks the download link action rather than opening the resource dialog', () => {
    render(
      <ProductActions
        product={{ title: 'Paper Bag', slug: 'paper-bag' }}
        downloads={[
          {
            id: 'catalog',
            title: 'Product catalog',
            url: 'https://media.example.invalid/catalog.pdf?download=1',
            mimeType: 'application/pdf',
            filesize: 12000,
          },
        ]}
      />,
    )
    expect(window.dataLayer).toEqual([])
    fireEvent.click(screen.getByRole('button', { name: 'Download' }))
    expect(window.dataLayer).toEqual([])
    const download = screen.getByRole('link', { name: /Product catalog/ })
    expect(download.getAttribute('href')).toBe(
      'https://media.example.invalid/catalog.pdf?download=1',
    )
    fireEvent.click(download)
    expect(window.dataLayer).toEqual([
      { event: 'file_download', file_name: 'catalog.pdf', product_slug: 'paper-bag' },
    ])
  })

  it('tracks contact methods without sending contact values or the address', () => {
    render(
      <ContactList
        contact={{
          address: '123 Test Street',
          phone: '+1 555 0100',
          salesEmail: 'sales@example.invalid',
        }}
      />,
    )
    expect(window.dataLayer).toEqual([])
    const phone = screen.getByRole('link', { name: '+1 555 0100' })
    const email = screen.getByRole('link', { name: 'sales@example.invalid' })
    expect(phone.getAttribute('href')).toBe('tel:+1 555 0100')
    expect(email.getAttribute('href')).toBe('mailto:sales@example.invalid')
    // Prevent jsdom navigation; the link's normal action remains untouched in the component.
    phone.addEventListener('click', (event) => event.preventDefault())
    email.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(phone)
    fireEvent.click(email)
    expect(window.dataLayer).toEqual([
      { event: 'contact_click', method: 'phone' },
      { event: 'contact_click', method: 'email' },
    ])
  })
})
