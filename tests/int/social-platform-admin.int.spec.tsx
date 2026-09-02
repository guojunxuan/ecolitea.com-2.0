import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const closeModal = vi.hoisted(() => vi.fn())
const openModal = vi.hoisted(() => vi.fn())

vi.mock('@payloadcms/ui', () => ({
  DialogBody: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogCancel: ({ label, onClick }: { label?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  DialogConfirm: ({ label, onClick }: { label?: string; onClick: () => Promise<void> | void }) => (
    <button
      onClick={async () => {
        await onClick()
        closeModal('create-social-platform-test')
      }}
    >
      {label}
    </button>
  ),
  DialogFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  DialogHeader: ({ title }: { title?: React.ReactNode }) => (
    <h2 id="social-platform-dialog-title">{title}</h2>
  ),
  DialogModal: ({ children }: React.PropsWithChildren<{ slug: string }>) => (
    <div aria-labelledby="social-platform-dialog-title" role="dialog">
      {children}
    </div>
  ),
  TextInput: ({
    label,
    onChange,
    required,
    value,
  }: {
    label?: string
    onChange?: React.ChangeEventHandler<HTMLInputElement>
    required?: boolean
    value?: string
  }) => <input aria-label={label} onChange={onChange} required={required} value={value} />,
  UploadInput: ({ label }: { label?: string }) => <div>{label}</div>,
  useConfig: () => ({ config: { routes: { api: '/api' }, serverURL: 'https://cms.test' } }),
  useModal: () => ({ closeModal, openModal }),
}))

import { SocialPlatformCreateModal } from '@/SiteSettings/components/SocialPlatformCreateModal'

describe('SocialPlatformCreateModal', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  const renderModal = (onCreated = vi.fn()) => {
    render(
      <SocialPlatformCreateModal
        modalSlug="create-social-platform-test"
        onCreated={onCreated}
        open
      />,
    )
    return onCreated
  }

  it('renders the compact creation form with accessible controls', () => {
    renderModal()

    expect(screen.getByRole('dialog', { name: 'Create Social Platform' })).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Platform' }).required).toBe(true)
    expect(screen.getByText('Icon')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy()
  })

  it('cancels without submitting', () => {
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(fetch).not.toHaveBeenCalled()
    expect(closeModal).toHaveBeenCalledWith('create-social-platform-test')
  })

  it('preserves the platform when Payload rejects validation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'Platform already exists.' }] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    renderModal()
    const platform = screen.getByRole('textbox', { name: 'Platform' })
    fireEvent.change(platform, { target: { value: 'LinkedIn' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(await screen.findByText('Platform already exists.')).toBeTruthy()
    expect((platform as HTMLInputElement).value).toBe('LinkedIn')
    await waitFor(() => expect(openModal).toHaveBeenCalledTimes(2))
  })

  it('submits only once when Save is double-clicked', async () => {
    let resolveRequest: ((value: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve) => (resolveRequest = resolve)),
    )
    renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: 'Platform' }), {
      target: { value: 'LinkedIn' },
    })
    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(save)
    fireEvent.click(save)

    expect(fetch).toHaveBeenCalledTimes(1)
    resolveRequest?.(Response.json({ doc: { id: 'social-1', platform: 'LinkedIn' } }))
    await waitFor(() => expect(closeModal).toHaveBeenCalled())
  })

  it('posts the fields and returns the created document', async () => {
    const doc = { id: 'social-1', platform: 'LinkedIn', icon: 'asset-1' }
    vi.mocked(fetch).mockResolvedValue(Response.json({ doc }))
    const onCreated = renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: 'Platform' }), {
      target: { value: 'LinkedIn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(doc))
    expect(fetch).toHaveBeenCalledWith('https://cms.test/api/social-platforms', {
      body: JSON.stringify({ platform: 'LinkedIn', icon: null }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })
})
