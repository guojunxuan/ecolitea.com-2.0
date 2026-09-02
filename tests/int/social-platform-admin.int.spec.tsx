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

const relationshipFieldState = vi.hoisted(() => ({
  path: 'socialLinks.0.platform',
  resolvedPaths: {} as Record<string, string>,
  setValue: vi.fn(),
  value: 'existing-platform' as null | string,
}))

vi.mock('@payloadcms/ui', () => {
  const DialogSlugContext = React.createContext('')

  return {
    Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
      <button onClick={onClick}>{children}</button>
    ),
    DialogBody: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
    DialogCancel: ({ label, onClick }: { label?: string; onClick?: () => void }) => (
      <button onClick={onClick}>{label}</button>
    ),
    DialogConfirm: ({
      label,
      onClick,
    }: {
      label?: string
      onClick: () => Promise<void> | void
    }) => {
      const [isConfirming, setConfirming] = useState(false)
      const slug = React.useContext(DialogSlugContext)
      return (
        <button
          disabled={isConfirming}
          onClick={async () => {
            if (isConfirming) return
            setConfirming(true)
            await onClick()
            setConfirming(false)
            modalState.closeModal(slug)
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
        <DialogSlugContext.Provider value={slug}>
          <div
            aria-labelledby="social-platform-dialog-title"
            data-close-on-esc={String(closeOnEsc)}
            data-modal-slug={slug}
            data-size={size}
            role="dialog"
          >
            {children}
          </div>
        </DialogSlugContext.Provider>
      ) : null
    },
    mergeFieldStyles: () => undefined,
    RelationshipInput: ({
      allowCreate,
      formatDisplayedOptions,
      onChange,
      value,
    }: {
      allowCreate?: boolean
      formatDisplayedOptions?: (options: Array<{ label: string; options: unknown[] }>) => Array<{
        label: string
        relationTo?: string
        value: number | string
      }>
      onChange: (value: { relationTo: string; value: number | string }) => void
      value?: { relationTo: string; value: number | string }
    }) => {
      const options =
        formatDisplayedOptions?.([
          {
            label: 'Social Platforms',
            options: [
              { allowEdit: true, label: 'GitHub', relationTo: 'social-platforms', value: 'github' },
              { allowEdit: true, label: 'X', relationTo: 'social-platforms', value: 'x' },
            ],
          },
        ]) ?? []

      return (
        <div
          data-allow-create={String(allowCreate)}
          data-relationship-input="true"
          data-value={value?.value || ''}
        >
          {options.map((option) => (
            <button
              data-relationship-option="true"
              key={option.value}
              onClick={() =>
                onChange({
                  relationTo: option.relationTo || 'social-platforms',
                  value: option.value,
                })
              }
            >
              {option.label}
            </button>
          ))}
          <button onClick={() => onChange(null as never)}>Clear relationship</button>
        </div>
      )
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
      value,
    }: {
      allowCreate?: boolean
      filterOptions?: unknown
      hasMany?: boolean
      label?: string
      onChange?: (value: string) => void
      relationTo?: string
      required?: boolean
      value?: number | string
    }) => (
      <div
        aria-label={label}
        data-allow-create={String(allowCreate)}
        data-filter-options={JSON.stringify(filterOptions)}
        data-has-many={String(hasMany)}
        data-relation-to={relationTo}
        data-required={String(required)}
        data-value={value || ''}
        role="group"
      >
        {label}
        {required ? ' *' : ''}
        <button onClick={() => onChange?.('asset-1')}>Choose test icon</button>
      </div>
    ),
    useConfig: () => ({ config: { routes: { api: '/api' }, serverURL: 'https://cms.test' } }),
    useField: ({ potentiallyStalePath }: { potentiallyStalePath?: string } = {}) => ({
      ...relationshipFieldState,
      path:
        relationshipFieldState.resolvedPaths[potentiallyStalePath || ''] ||
        relationshipFieldState.path,
    }),
    useModal: () => ({ closeModal: modalState.closeModal, openModal: modalState.openModal }),
  }
})

import { SocialPlatformCreateModal } from '@/SiteSettings/components/SocialPlatformCreateModal'
import { SocialPlatformCreateActions } from '@/SiteSettings/components/SocialPlatformCreateActions'
import { SocialPlatformRelationshipField } from '@/SiteSettings/components/SocialPlatformRelationshipField'

const completeForm = () => {
  fireEvent.change(screen.getByRole('textbox', { name: 'Platform' }), {
    target: { value: 'LinkedIn' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Choose test icon' }))
}

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
    completeForm()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()

    modalState.openModal('create-social-platform-test')
    await screen.findByRole('dialog', { name: 'Create Social Platform' })
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Platform' }).value).toBe('')
    expect(screen.getByRole('group', { name: 'Icon' }).getAttribute('data-value')).toBe('')
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
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    modalState.openModal('create-social-platform-test')
    await screen.findByRole('dialog', { name: 'Create Social Platform' })
    expect(screen.getByRole<HTMLInputElement>('textbox', { name: 'Platform' }).value).toBe('')
    expect(screen.getByRole('group', { name: 'Icon' }).getAttribute('data-value')).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('social platform creation entry points', () => {
  beforeEach(() => {
    modalState.reset()
    relationshipFieldState.path = 'socialLinks.0.platform'
    relationshipFieldState.resolvedPaths = {}
    relationshipFieldState.value = 'existing-platform'
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('opens the shared modal from the top-level create action', async () => {
    render(<SocialPlatformCreateActions />)

    fireEvent.click(screen.getByRole('button', { name: 'Create Social Platform' }))

    expect(await screen.findByRole('dialog', { name: 'Create Social Platform' })).toBeTruthy()
  })

  it('appends one final create option that opens the modal without changing the value', async () => {
    render(
      <SocialPlatformRelationshipField
        field={{ name: 'platform', relationTo: 'social-platforms', type: 'relationship' }}
        path="socialLinks.0.platform"
      />,
    )

    const options = screen
      .getAllByRole('button')
      .filter((button) => button.hasAttribute('data-relationship-option'))
    expect(options.map((option) => option.textContent)).toEqual([
      'GitHub',
      'X',
      'Create Social Platform',
    ])
    expect(
      screen
        .getByRole('button', { name: 'Clear relationship' })
        .parentElement?.getAttribute('data-allow-create'),
    ).toBe('false')

    fireEvent.click(options.at(-1)!)

    expect(relationshipFieldState.setValue).not.toHaveBeenCalled()
    expect(await screen.findByRole('dialog', { name: 'Create Social Platform' })).toBeTruthy()
  })

  it('preserves Payload selection, reselection, and clear modification semantics', () => {
    const field = {
      name: 'platform',
      relationTo: 'social-platforms',
      type: 'relationship',
    } as const
    const { unmount } = render(
      <SocialPlatformRelationshipField field={field} path="socialLinks.0.platform" />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'GitHub' }))
    expect(relationshipFieldState.setValue).toHaveBeenLastCalledWith('github', false)

    relationshipFieldState.value = 'github'
    unmount()
    render(<SocialPlatformRelationshipField field={field} path="socialLinks.0.platform" />)
    fireEvent.click(screen.getByRole('button', { name: 'GitHub' }))
    expect(relationshipFieldState.setValue).toHaveBeenLastCalledWith('github', true)

    fireEvent.click(screen.getByRole('button', { name: 'Clear relationship' }))
    expect(relationshipFieldState.setValue).toHaveBeenLastCalledWith(null, false)

    relationshipFieldState.value = null
    cleanup()
    render(<SocialPlatformRelationshipField field={field} path="socialLinks.0.platform" />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear relationship' }))
    expect(relationshipFieldState.setValue).toHaveBeenLastCalledWith(null, true)
  })

  it('uses resolved row paths to isolate modal state across relationship rows', async () => {
    relationshipFieldState.resolvedPaths = {
      'stale-row-a.platform': 'socialLinks.3.platform',
      'stale-row-b.platform': 'socialLinks.7.platform',
    }
    const field = {
      name: 'platform',
      relationTo: 'social-platforms',
      type: 'relationship',
    } as const
    render(
      <>
        <SocialPlatformRelationshipField field={field} path="stale-row-a.platform" />
        <SocialPlatformRelationshipField field={field} path="stale-row-b.platform" />
      </>,
    )

    const createOptions = screen.getAllByRole('button', { name: 'Create Social Platform' })
    fireEvent.click(createOptions[0])
    const firstDialog = await screen.findByRole('dialog', { name: 'Create Social Platform' })
    const firstSlug = firstDialog.getAttribute('data-modal-slug')
    expect(firstSlug).toContain('socialLinks-3-platform')

    fireEvent.click(createOptions[1])
    const dialogs = await screen.findAllByRole('dialog', { name: 'Create Social Platform' })
    const secondSlug = dialogs[1].getAttribute('data-modal-slug')
    expect(secondSlug).toContain('socialLinks-7-platform')
    expect(secondSlug).not.toBe(firstSlug)
  })

  it.each([
    {
      field: {
        hasMany: true,
        name: 'platform',
        relationTo: 'social-platforms',
        type: 'relationship',
      } as const,
      name: 'has-many',
    },
    {
      field: {
        name: 'platform',
        relationTo: ['social-platforms', 'brand-assets'] as ['social-platforms', 'brand-assets'],
        type: 'relationship',
      } as const,
      name: 'polymorphic',
    },
  ])(
    'rejects $name field configurations instead of corrupting relationship values',
    ({ field }) => {
      expect(() =>
        render(<SocialPlatformRelationshipField field={field} path="socialLinks.0.platform" />),
      ).toThrow('requires a scalar social-platforms relationship field')
    },
  )

  it('selects the newly created platform and closes the relationship modal', async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ doc: { id: 'platform-id', platform: 'LinkedIn' } }),
    )
    render(
      <SocialPlatformRelationshipField
        field={{ name: 'platform', relationTo: 'social-platforms', type: 'relationship' }}
        path="socialLinks.0.platform"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Create Social Platform' }))
    await screen.findByRole('dialog', { name: 'Create Social Platform' })
    completeForm()
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(relationshipFieldState.setValue).toHaveBeenCalledWith('platform-id'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })
})
