import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it, vi } from 'vitest'

const adminState = vi.hoisted(() => ({
  api: { data: null as null | { platform?: string }, isError: false, isLoading: false },
  apiURL: '',
  drawers: new Map<
    string,
    {
      closeDrawer: ReturnType<typeof vi.fn>
      onSave?: (args: {
        doc: { id: number | string; platform?: string }
        operation: string
      }) => void
      openDrawer: ReturnType<typeof vi.fn>
      redirectAfterCreate?: boolean
    }
  >(),
  field: {
    path: 'socialLinks.0.platform',
    setValue: vi.fn(),
    value: 'existing-platform' as null | number | string,
  },
  document: { id: 'document-id', isEditing: true },
  drawerContext: { drawerSlug: 'parent-social-platform-drawer' },
  rowData: {} as { platform?: null | number | string | { platform?: string } },
}))

const appendArrayPopup = (fieldName: string) => {
  const popup = document.createElement('div')
  popup.className = 'popup__content test-array-popup'
  popup.dataset.field = fieldName
  popup.innerHTML = [
    '<button class="array-actions__action array-actions__move-up">Move Up</button>',
    '<button class="array-actions__action">Move Down</button>',
    '<button class="array-actions__action array-actions__add">Add Below</button>',
    '<button class="array-actions__action array-actions__duplicate">Duplicate</button>',
    '<button class="array-actions__action array-actions__copy">Copy Row</button>',
    '<button class="array-actions__action array-actions__paste-below">Paste Below</button>',
    '<button class="array-actions__action array-actions__paste">Replace Row</button>',
    '<button class="array-actions__action array-actions__remove">Remove</button>',
  ].join('')
  document.body.append(popup)
}

vi.mock('@payloadcms/ui', () => ({
  ArrayField: (props: { field: { name: string } }) => (
    <div data-array-field={props.field.name}>
      <button className="array-field__header-action">Field clipboard</button>
      <button
        aria-label={`${props.field.name} row actions`}
        className="array-actions__button"
        onClick={() => appendArrayPopup(props.field.name)}
      >
        Row actions
      </button>
    </div>
  ),
  Button: ({
    children,
    onClick,
    type,
  }: React.PropsWithChildren<React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button onClick={onClick} type={type}>
      {children}
    </button>
  ),
  PopupList: {
    Button: ({ children, onClick }: React.PropsWithChildren<{ onClick?: () => void }>) => (
      <button onClick={onClick} type="button">
        {children}
      </button>
    ),
  },
  RelationshipField: ({
    field,
    path,
  }: {
    field: { admin?: { allowCreate?: boolean; allowEdit?: boolean } }
    path: string
  }) => (
    <div
      data-allow-create={String(field.admin?.allowCreate)}
      data-allow-edit={String(field.admin?.allowEdit ?? true)}
      data-native-relationship={path}
    >
      <button className="rs__control" type="button">
        Platform
      </button>
    </div>
  ),
  TextField: ({ readOnly }: { readOnly?: boolean }) => (
    <input aria-label="Platform" readOnly={readOnly} />
  ),
  toast: { success: vi.fn() },
  useConfig: () => ({ config: { routes: { api: '/api' }, serverURL: '' } }),
  useDocumentDrawer: (options: { collectionSlug: string; drawerSlug?: string }) => {
    const key = options.drawerSlug || `auto-${adminState.drawers.size}`
    const drawer = {
      closeDrawer: vi.fn(),
      openDrawer: vi.fn(),
    } as {
      closeDrawer: ReturnType<typeof vi.fn>
      onSave?: (args: {
        doc: { id: number | string; platform?: string }
        operation: string
      }) => void
      openDrawer: ReturnType<typeof vi.fn>
      redirectAfterCreate?: boolean
    }
    adminState.drawers.set(key, drawer)
    const DocumentDrawer = ({
      onSave,
      redirectAfterCreate,
    }: {
      onSave?: typeof drawer.onSave
      redirectAfterCreate?: boolean
    }) => {
      drawer.onSave = onSave
      drawer.redirectAfterCreate = redirectAfterCreate
      return <aside data-collection={options.collectionSlug} data-drawer={key} />
    }
    return [DocumentDrawer, () => null, drawer]
  },
  useDocumentDrawerContext: () => adminState.drawerContext,
  useDocumentInfo: () => adminState.document,
  useField: () => adminState.field,
  usePayloadAPI: (url: string) => {
    adminState.apiURL = url
    return [adminState.api]
  },
  useRowLabel: () => ({ data: adminState.rowData }),
  useTranslation: () => ({ t: () => 'Create New' }),
}))

import { ArrayField, toast } from '@payloadcms/ui'

import {
  SocialLinkRowLabel,
  getSocialLinkRowLabel,
} from '@/SiteSettings/components/SocialLinkRowLabel'
import { SocialLinksArrayField } from '@/SiteSettings/components/SocialLinksArrayField'
import { SocialPlatformCreateActions } from '@/SiteSettings/components/SocialPlatformCreateActions'
import { SocialPlatformNameField } from '@/SiteSettings/components/SocialPlatformNameField'

afterEach(() => {
  cleanup()
  document.querySelectorAll('.test-array-popup').forEach((popup) => popup.remove())
  adminState.api = { data: null, isError: false, isLoading: false }
  adminState.apiURL = ''
  adminState.drawers.clear()
  adminState.field.path = 'socialLinks.0.platform'
  adminState.field.value = 'existing-platform'
  adminState.document = { id: 'document-id', isEditing: true }
  adminState.drawerContext = { drawerSlug: 'parent-social-platform-drawer' }
  adminState.rowData = {}
  vi.clearAllMocks()
})

describe('Social Link admin components', () => {
  it('resolves populated and scalar row labels without exposing relationship IDs', () => {
    expect(getSocialLinkRowLabel({ platform: 'GitHub' })).toBe('GitHub')
    expect(getSocialLinkRowLabel(null)).toBe('Unselected platform')
    expect(getSocialLinkRowLabel('raw-document-id')).toBe('Unavailable platform')
    expect(getSocialLinkRowLabel({})).toBe('Unavailable platform')

    adminState.rowData = { platform: 'platform-id' }
    adminState.api = { data: { platform: 'LinkedIn' }, isError: false, isLoading: false }
    render(<SocialLinkRowLabel path="socialLinks.0" />)
    expect(screen.getByText('LinkedIn')).toBeTruthy()
    expect(screen.queryByText('platform-id')).toBeNull()
    expect(adminState.apiURL).toBe('/api/social-platforms/platform-id?depth=0')
  })

  it('uses stable unselected, loading, and unavailable row-label states', () => {
    render(<SocialLinkRowLabel path="socialLinks.0" />)
    expect(screen.getByText('Unselected platform')).toBeTruthy()
    cleanup()

    adminState.rowData = { platform: 'opaque-id' }
    adminState.api = { data: null, isError: false, isLoading: true }
    render(<SocialLinkRowLabel path="socialLinks.0" />)
    expect(screen.getByText('Social Link')).toBeTruthy()
    expect(screen.queryByText('opaque-id')).toBeNull()
    cleanup()

    adminState.api = { data: null, isError: true, isLoading: false }
    render(<SocialLinkRowLabel path="socialLinks.0" />)
    expect(screen.getByText('Unavailable platform')).toBeTruthy()
    expect(screen.queryByText('opaque-id')).toBeNull()
  })

  it('opens the shared native Drawer and reports top-level create success', () => {
    render(<SocialPlatformCreateActions />)
    fireEvent.click(screen.getByRole('button', { name: 'Create Social Platform' }))

    const drawer = adminState.drawers.get('site-settings-social-platform')
    expect(drawer?.openDrawer).toHaveBeenCalledTimes(1)
    expect(drawer?.redirectAfterCreate).toBe(false)
    expect(document.querySelector('[data-collection="social-platforms"]')).toBeTruthy()

    drawer?.onSave?.({ doc: { id: 'platform-id', platform: 'LinkedIn' }, operation: 'create' })
    expect(drawer?.closeDrawer).toHaveBeenCalledTimes(1)
    expect(toast.success).toHaveBeenCalledWith('Social platform created.')
  })

  it('scopes hidden array actions to Social Links and keeps valid actions visible', async () => {
    const { container } = render(
      <>
        <SocialLinksArrayField field={{ name: 'socialLinks' } as never} path="socialLinks" />
        <ArrayField field={{ name: 'otherArray' } as never} path="otherArray" />
      </>,
    )

    const socialHeaderAction = container.querySelector<HTMLElement>(
      '.site-settings-social-links .array-field__header-action',
    )
    const otherHeaderAction = container.querySelector<HTMLElement>(
      '[data-array-field="otherArray"] .array-field__header-action',
    )
    expect(socialHeaderAction?.closest('.site-settings-social-links')).toBeTruthy()
    expect(otherHeaderAction?.closest('.site-settings-social-links')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'socialLinks row actions' }))
    const socialPopup = document.querySelector<HTMLElement>('[data-field="socialLinks"]')!
    // The portaled popup is Payload-managed; hiding is pure CSS, so the field must not mutate it.
    expect(socialPopup.className).toBe('popup__content test-array-popup')
    expect(socialPopup.querySelector('.array-actions__duplicate')).toBeTruthy()
    expect(socialPopup.querySelector('.array-actions__copy')).toBeTruthy()
    expect(socialPopup.querySelector('.array-actions__paste-below')).toBeTruthy()
    expect(socialPopup.querySelector('.array-actions__paste')).toBeTruthy()
    expect(socialPopup.querySelector('.array-actions__add')).toBeTruthy()
    expect(socialPopup.querySelector('.array-actions__remove')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'otherArray row actions' }))
    const otherPopup = document.querySelector<HTMLElement>('[data-field="otherArray"]')!
    expect(otherPopup.className).toBe('popup__content test-array-popup')
    expect(otherPopup.querySelector('.array-actions__duplicate')).toBeTruthy()
  })

  it('keeps the Platform name read-only while editing', () => {
    render(<SocialPlatformNameField field={{ name: 'platform' } as never} path="platform" />)
    expect(screen.getByRole('textbox', { name: 'Platform' }).hasAttribute('readonly')).toBe(true)
  })
})

// socialLinksArrayField.scss hides row actions with Payload's runtime class and ARIA conventions.
// These read the installed Payload dist so an upgrade that renames them fails here, not silently.
describe('Social Links row-action CSS contract', () => {
  const ui = (file: string) => readFileSync(`node_modules/@payloadcms/ui/dist/${file}`, 'utf8')

  it('relies on Payload array action, popup, and header-action class names', () => {
    const arrayAction = ui('elements/ArrayAction/index.js')
    expect(arrayAction).toMatch(/const baseClass = 'array-actions'/)
    for (const action of ['duplicate', 'copy', 'paste-below', 'paste']) {
      expect(arrayAction, `Payload renamed array-actions__${action}. Review socialLinksArrayField.scss.`)
        .toContain(`\${baseClass}__${action}\``)
    }
    expect(ui('elements/Popup/index.js')).toMatch(/const baseClass = 'popup'[\s\S]*\$\{baseClass\}__content/)
    const arrayField = ui('fields/Array/index.js')
    expect(arrayField).toMatch(/const baseClass = 'array-field'/)
    expect(arrayField).toContain('${baseClass}__header-action`')
  })

  it('relies on the popup trigger exposing aria-expanded', () => {
    expect(ui('elements/Popup/PopupTrigger/index.js')).toMatch(/['"]?aria-expanded['"]?: active/)
  })

  it('keeps the scss selectors aligned with those conventions', () => {
    const scss = readFileSync('src/SiteSettings/components/socialLinksArrayField.scss', 'utf8')
    expect(scss).toContain(".site-settings-social-links .array-actions [aria-expanded='true']")
    expect(scss).toContain('.popup__content')
    expect(scss).toContain('.site-settings-social-links .array-field__header-action')
  })
})
