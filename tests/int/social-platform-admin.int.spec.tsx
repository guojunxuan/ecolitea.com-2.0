import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useState, useSyncExternalStore } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const modalState = vi.hoisted(() => {
  const openSlugs = new Set<string>()
  const listeners = new Set<() => void>()
  const emit = () => listeners.forEach((listener) => listener())
  return {
    closeModal: vi.fn((slug: string) => {
      openSlugs.delete(slug)
      emit()
    }),
    isOpen: (slug: string) => openSlugs.has(slug),
    openModal: vi.fn((slug: string) => {
      openSlugs.add(slug)
      emit()
    }),
    reset: () => {
      openSlugs.clear()
      emit()
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
})

vi.mock('@payloadcms/ui', () => ({
  DialogBody: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  DialogCancel: ({ label, onClick }: { label?: string; onClick?: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  DialogConfirm: ({ label, onClick }: { label?: string; onClick: () => Promise<void> | void }) => {
    const [isConfirming, setConfirming] = useState(false)
    return (
      <button
        disabled={isConfirming}
        onClick={async () => {
          if (isConfirming) return
          setConfirming(true)
          await onClick()
          setConfirming(false)
          modalState.closeModal('create-social-platform-test')
        }}
      >
        {label}
      </button>
    )
  },
  DialogFooter: ({ children }: React.PropsWithChildren) => <footer>{children}</footer>,
  DialogHeader: ({ showClose, title }: { showClose?: boolean; title?: React.ReactNode }) => (
    <header data-show-close={String(showClose)}>
      <h2 id="social-platform-dialog-title">{title}</h2>
    </header>
  ),
  DialogModal: ({
    children,
    closeOnEsc,
    size,
    slug,
  }: React.PropsWithChildren<{ closeOnEsc?: boolean; size?: string; slug: string }>) => {
    const isOpen = useSyncExternalStore(
      modalState.subscribe,
      () => modalState.isOpen(slug),
      () => false,
    )
    return isOpen ? (
      <div
        aria-labelledby="social-platform-dialog-title"
        data-close-on-esc={String(closeOnEsc)}
        data-size={size}
        role="dialog"
      >
        {children}
      </div>
    ) : null
  },
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
  UploadInput: ({
    allowCreate,
    filterOptions,
    hasMany,
    label,
    onChange,
    relationTo,
    required,
  }: {
    allowCreate?: boolean
    filterOptions?: unknown
    hasMany?: boolean
    label?: string
    onChange?: (value: string) => void
    relationTo?: string
    required?: boolean
  }) => (
    <div
      aria-label={label}
      data-allow-create={String(allowCreate)}
      data-filter-options={JSON.stringify(filterOptions)}
      data-has-many={String(hasMany)}
      data-relation-to={relationTo}
      data-required={String(required)}
      role="group"
    >
      {label}
      {required ? ' *' : ''}
      <button onClick={() => onChange?.('asset-1')}>Choose test icon</button>
    </div>
  ),
  useConfig: () => ({ config: { routes: { api: '/api' }, serverURL: 'https://cms.test' } }),
  useModal: () => ({ closeModal: modalState.closeModal, openModal: modalState.openModal }),
}))

import { SocialPlatformCreateModal } from '@/SiteSettings/components/SocialPlatformCreateModal'

describe('SocialPlatformCreateModal', () => {
  beforeEach(() => {
    modalState.reset()
    vi.stubGlobal('fetch', vi.fn())
  })
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  const renderModal = async (onCreated = vi.fn()) => {
    render(
      <SocialPlatformCreateModal
        modalSlug="create-social-platform-test"
        onCreated={onCreated}
        open
      />,
    )
    await screen.findByRole('dialog', { name: 'Create Social Platform' })
    return onCreated
  }
  const completeForm = () => {
    fireEvent.change(screen.getByRole('textbox', { name: 'Platform' }), {
      target: { value: 'LinkedIn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Choose test icon' }))
  }

  it('passes the required dialog and upload configuration to Payload UI', async () => {
    await renderModal()
    const dialog = screen.getByRole('dialog', { name: 'Create Social Platform' })
    const icon = screen.getByRole('group', { name: 'Icon' })
    expect(dialog.getAttribute('data-size')).toBe('medium')
    expect(dialog.getAttribute('data-close-on-esc')).toBe('true')
    expect(dialog.querySelector('header')?.getAttribute('data-show-close')).toBe('true')
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Platform' }).required).toBe(true)
    expect(icon.getAttribute('data-required')).toBe('true')
    expect(icon.getAttribute('data-relation-to')).toBe('brand-assets')
    expect(icon.getAttribute('data-allow-create')).toBe('true')
    expect(icon.getAttribute('data-has-many')).toBe('false')
    expect(JSON.parse(icon.getAttribute('data-filter-options') || '{}')).toEqual({
      'brand-assets': { mimeType: { equals: 'image/svg+xml' } },
    })
  })

  it('cancels without submitting', async () => {
    await renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('requires an icon before posting and preserves the platform', async () => {
    await renderModal()
    fireEvent.change(screen.getByRole('textbox', { name: 'Platform' }), {
      target: { value: 'LinkedIn' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Icon is required.')).toBeTruthy()
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Platform' }).value).toBe(
      'LinkedIn',
    )
  })

  it('reopens with the platform intact when Payload rejects validation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ errors: [{ message: 'Platform already exists.' }] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    await renderModal()
    completeForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(modalState.closeModal).toHaveBeenCalled())
    expect(await screen.findByText('Platform already exists.')).toBeTruthy()
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Platform' }).value).toBe(
      'LinkedIn',
    )
  })

  it('submits only once when Save is double-clicked', async () => {
    let resolveRequest: ((value: Response) => void) | undefined
    vi.mocked(fetch).mockImplementation(
      () => new Promise<Response>((resolve) => (resolveRequest = resolve)),
    )
    await renderModal()
    completeForm()
    const save = screen.getByRole('button', { name: 'Save' })
    fireEvent.click(save)
    fireEvent.click(save)
    expect(fetch).toHaveBeenCalledTimes(1)
    resolveRequest?.(Response.json({ doc: { id: 'social-1', platform: 'LinkedIn' } }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('posts only the fields and returns the created document', async () => {
    const doc = { id: 'social-1', platform: 'LinkedIn', icon: 'asset-1' }
    vi.mocked(fetch).mockResolvedValue(Response.json({ doc }))
    const onCreated = await renderModal()
    completeForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(doc))
    expect(fetch).toHaveBeenCalledWith('https://cms.test/api/social-platforms', {
      body: JSON.stringify({ platform: 'LinkedIn', icon: 'asset-1' }),
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
    })
  })
})
