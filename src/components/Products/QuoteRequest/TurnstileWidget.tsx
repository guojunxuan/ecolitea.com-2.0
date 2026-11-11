'use client'

import { useEffect, useRef } from 'react'

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string
      callback: (token: string) => void
      'expired-callback': () => void
      'error-callback': () => void
    },
  ) => string
  reset: (widgetId: string) => void
  remove: (widgetId: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
let scriptPromise: Promise<void> | undefined

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve()
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = SCRIPT_SRC
    script.async = true
    const fail = () => {
      clearTimeout(timeout)
      scriptPromise = undefined
      script.remove()
      reject(new Error('Turnstile script failed to load'))
    }
    const timeout = setTimeout(fail, 15_000)
    script.onload = () => {
      if (!window.turnstile) return fail()
      clearTimeout(timeout)
      resolve()
    }
    script.onerror = fail
    document.head.appendChild(script)
  })
  return scriptPromise
}

type Props = {
  siteKey: string
  onToken: (token: string | null) => void
  onUnavailable: () => void
  /** Increment to discard the current (single-use) token and run a fresh challenge. */
  resetKey: number
}

export function TurnstileWidget({ siteKey, onToken, onUnavailable, resetKey }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | undefined>(undefined)
  const handlers = useRef({ onToken, onUnavailable })

  useEffect(() => {
    handlers.current = { onToken, onUnavailable }
  })

  useEffect(() => {
    let cancelled = false
    loadTurnstile()
      .then(() => {
        if (cancelled || !container.current) return
        if (!window.turnstile) throw new Error('Turnstile API is unavailable')
        widgetId.current = window.turnstile.render(container.current, {
          sitekey: siteKey,
          callback: (token) => handlers.current.onToken(token),
          'expired-callback': () => handlers.current.onToken(null),
          'error-callback': () => {
            handlers.current.onToken(null)
            handlers.current.onUnavailable()
          },
        })
      })
      .catch(() => {
        if (!cancelled) handlers.current.onUnavailable()
      })
    return () => {
      cancelled = true
      if (widgetId.current) window.turnstile?.remove(widgetId.current)
      widgetId.current = undefined
    }
  }, [siteKey])

  useEffect(() => {
    if (resetKey > 0 && widgetId.current) window.turnstile?.reset(widgetId.current)
  }, [resetKey])

  return <div ref={container} />
}
