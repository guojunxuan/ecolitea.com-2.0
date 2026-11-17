import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FormBlock, type FormBlockType } from '@/collections/Pages/blocks/Form/Component'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

const form = (fields: unknown[]): FormBlockType['form'] => ({
  id: 'optional-fields-form',
  title: 'Test inquiry',
  submitButtonLabel: 'Send',
  confirmationType: 'redirect',
  redirect: { type: 'custom', url: '/thanks' },
  emails: [],
  fields: fields as FormBlockType['form']['fields'],
})
const optionalFields = [
  { blockType: 'text', name: 'name', label: 'Name', required: true },
  { blockType: 'select', name: 'topic', label: 'Topic', options: [{ label: 'Tea', value: 'tea' }] },
  { blockType: 'number', name: 'quantity', label: 'Quantity' },
  { blockType: 'checkbox', name: 'updates', label: 'Updates' },
  { blockType: 'country', name: 'country', label: 'Country' },
  { blockType: 'state', name: 'state', label: 'State' },
]

beforeEach(() => {
  window.dataLayer = []
  push.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  delete window.dataLayer
})

describe('CMS form submission values', () => {
  it('submits with optional controls left empty and tracks only the successful response', async () => {
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const { submissionData } = JSON.parse(options.body as string)
      // Match the installed form-builder value validator (undefined is rejected).
      return submissionData.some((row: { value?: unknown }) => row.value === undefined)
        ? Response.json({ errors: [{ message: 'This field is required.' }] }, { status: 400 })
        : Response.json({ doc: { id: 'saved' } }, { status: 201 })
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<FormBlock enableIntro={false} form={form(optionalFields)} />)
    fireEvent.change(screen.getByRole('textbox', { name: /Name/ }), {
      target: { value: 'E2E Test' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.submissionData).toEqual([
      { field: 'name', value: 'E2E Test' },
      { field: 'updates', value: false },
    ])
    await waitFor(() => expect(push).toHaveBeenCalledWith('/thanks'))
    expect(window.dataLayer).toEqual([{ event: 'form_submit', form_title: 'Test inquiry' }])
  })

  it('preserves zero and an explicitly unchecked checkbox as meaningful values', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json({ doc: { id: 'saved' } }, { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    render(
      <FormBlock
        enableIntro={false}
        form={form([
          { blockType: 'number', name: 'quantity', label: 'Quantity', defaultValue: 0 },
          { blockType: 'checkbox', name: 'updates', label: 'Updates', defaultValue: false },
        ])}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).submissionData).toEqual([
      { field: 'quantity', value: '0' },
      { field: 'updates', value: false },
    ])
  })

  it.each(['text', 'select', 'number', 'checkbox'])(
    'blocks an empty required %s before calling the API',
    async (blockType) => {
      const fetchMock = vi.fn()
      vi.stubGlobal('fetch', fetchMock)
      render(
        <FormBlock
          enableIntro={false}
          form={form([
            {
              blockType,
              name: 'required',
              label: 'Required field',
              required: true,
              options: [{ label: 'Tea', value: 'tea' }],
            },
          ])}
        />,
      )
      fireEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(await screen.findByRole('alert')).toHaveProperty(
        'textContent',
        'This field is required',
      )
      expect(fetchMock).not.toHaveBeenCalled()
      expect(window.dataLayer).toEqual([])
    },
  )

  it('does not track a server validation failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ errors: [{ message: 'Invalid submission' }] }, { status: 400 }),
        ),
    )
    render(<FormBlock enableIntro={false} form={form([])} />)
    fireEvent.click(screen.getByRole('button', { name: 'Send' }))
    await screen.findByRole('alert')
    expect(window.dataLayer).toEqual([])
  })
})
