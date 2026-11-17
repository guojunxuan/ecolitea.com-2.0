import React from 'react'
import type { Payload } from 'payload'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { EmailStatus } from '@/plugins/email/admin/EmailStatus'
import { TestEmailButton } from '@/plugins/email/admin/TestEmailButton'

const state = vi.hoisted(() => ({
  user: { id: 'admin', role: 'admin', email: 'admin@example.test' } as {
    id: string
    role: string
    email: string
  } | null,
}))
vi.mock('@payloadcms/ui', () => ({
  useAuth: () => ({ user: state.user }),
  useConfig: () => ({
    config: { serverURL: 'https://admin.example.test/', routes: { api: '/content-api' } },
  }),
  Button: ({
    children,
    onClick,
    disabled,
    type,
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type={type} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}))
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  state.user = { id: 'admin', role: 'admin', email: 'admin@example.test' }
})

describe('email Admin controls', () => {
  it('shows settings source to admins and renders nothing for editors', async () => {
    vi.stubEnv('SMTP_HOST', '')
    const payload = {
      findGlobal: vi.fn(async () => ({
        smtpHost: 'smtp.example.test',
        smtpFromAddress: 'sender@example.test',
      })),
    } as unknown as Payload
    render(await EmailStatus({ payload, user: state.user as never }))
    expect(screen.getByText('Source: Site Settings')).toBeTruthy()
    cleanup()
    expect(await EmailStatus({ payload, user: { role: 'editor' } as never })).toBeNull()
  })
  it('shows env override without revealing connection or password values', async () => {
    vi.stubEnv('SMTP_HOST', 'private.example.test')
    vi.stubEnv('SMTP_PORT', '587')
    vi.stubEnv('SMTP_SECURE', 'starttls')
    vi.stubEnv('SMTP_FROM_ADDRESS', 'sender@example.test')
    vi.stubEnv('SMTP_PASSWORD', 'super-private-password')
    render(await EmailStatus({ payload: {} as Payload, user: state.user as never }))
    expect(screen.getByText('Source: Environment variables')).toBeTruthy()
    expect(screen.getByText(/read-only/)).toBeTruthy()
    expect(document.body.textContent).not.toContain('private.example.test')
    expect(document.body.textContent).not.toContain('super-private-password')
  })
  it('uses the public API route, sends no recipient payload, and shows server feedback', async () => {
    const fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'sent',
        message: 'Test email sent to your account email address.',
      }),
    }))
    vi.stubGlobal('fetch', fetch)
    render(<TestEmailButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }))
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Test email sent'))
    expect(fetch).toHaveBeenCalledWith(
      'https://admin.example.test/content-api/globals/site-settings/email-test',
      { method: 'POST', credentials: 'include' },
    )
  })
  it('reports failure and hides the control for editors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: 'SMTP authentication failed (535).' }),
      })),
    )
    render(<TestEmailButton />)
    fireEvent.click(screen.getByRole('button', { name: 'Send test email' }))
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toContain('SMTP authentication failed'),
    )
    cleanup()
    state.user = { id: 'editor', role: 'editor', email: 'editor@example.test' }
    render(<TestEmailButton />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
