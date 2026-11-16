'use client'

import type { ReactNode } from 'react'

import { trackEvent } from '@/consent/analytics'

export function ContactLink({
  children,
  href,
  method,
}: {
  children: ReactNode
  href: string
  method: 'email' | 'phone'
}) {
  return (
    <a href={href} onClick={() => trackEvent('contact_click', { method })}>
      {children}
    </a>
  )
}
