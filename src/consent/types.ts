export type ConsentCategory = 'analytics' | 'marketing'

export type ConsentState = {
  analytics: boolean
  marketing: boolean
  decidedAt: string
}
