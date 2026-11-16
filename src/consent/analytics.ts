'use client'

import type {} from './gtm'

type AnalyticsEventParams = {
  quote_submit: { product_slug: string }
  form_submit: { form_title: string }
  file_download: { file_name: string; product_slug: string }
  contact_click: { method: 'email' | 'phone' }
}

export function trackEvent<Name extends keyof AnalyticsEventParams>(
  name: Name,
  params: AnalyticsEventParams[Name],
): void {
  if (typeof window === 'undefined') return
  try {
    const layer = (window.dataLayer ??= [])
    layer.push({ event: name, ...params })
  } catch {
    // A third-party tag must never prevent a submission, download or contact action.
  }
}
