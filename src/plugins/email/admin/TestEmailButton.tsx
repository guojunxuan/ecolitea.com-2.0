'use client'

import { useRef, useState } from 'react'
import { Button, useAuth, useConfig } from '@payloadcms/ui'

/** Sends only the request; recipient and message are controlled by the server. */
export function TestEmailButton() {
  const { user } = useAuth()
  const { config } = useConfig()
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState('')
  const pending = useRef(false)
  if (user?.role !== 'admin') return null
  const send = async () => {
    if (pending.current) return
    pending.current = true
    setSending(true)
    setMessage('')
    try {
      const serverURL = (config.serverURL ?? '').replace(/\/+$/, '')
      const apiRoute = config.routes.api.replace(/\/+$/, '')
      const response = await fetch(`${serverURL}${apiRoute}/globals/site-settings/email-test`, {
        method: 'POST',
        credentials: 'include',
      })
      const result = (await response.json()) as { error?: string; message?: string }
      setMessage(
        response.ok
          ? (result.message ?? 'Test email sent.')
          : (result.error ?? 'Email delivery failed.'),
      )
    } catch {
      setMessage('Unable to send the test email. Try again.')
    } finally {
      pending.current = false
      setSending(false)
    }
  }
  return (
    <div className="email-test">
      <p>Save your changes first. A test email will be sent to your account email address.</p>
      <Button type="button" buttonStyle="secondary" disabled={sending} onClick={send}>
        {sending ? 'Sending…' : 'Send test email'}
      </Button>
      <p role="status" aria-live="polite">
        {message}
      </p>
    </div>
  )
}
