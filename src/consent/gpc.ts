import type { ConsentState } from './types'

type GpcNavigator = { globalPrivacyControl?: boolean }

export const detectGpc = (browser: GpcNavigator = navigator as Navigator & GpcNavigator): boolean =>
  browser.globalPrivacyControl === true

export const applyGpc = (state: ConsentState | null, gpc: boolean): ConsentState | null =>
  state && gpc ? { ...state, marketing: false } : state
