import { describe, expect, it } from 'vitest'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import configPromise from '@/payload.config'
import { SiteSettings } from '@/SiteSettings/config'
import {
  siteSettingsTabs,
  validateAbsoluteHttpURL,
} from '@/SiteSettings/fields'

describe('Site Settings Global', () => {
  it('uses five unnamed tabs so persisted fields remain flat', () => {
    expect(siteSettingsTabs.type).toBe('tabs')
    expect(siteSettingsTabs.tabs.map((tab) => tab.label)).toEqual([
      'General',
      'Branding',
      'Contact',
      'Social',
      'Legal',
    ])
    expect(siteSettingsTabs.tabs.every((tab) => !('name' in tab))).toBe(true)
  })

  it('registers the expected Global identity and access behavior', async () => {
    const guestRequest = { req: { payload: { config: {} } } }
    const authenticatedRequest = { req: { payload: { config: {} }, user: {} } }
    const readAccess = SiteSettings.access?.read
    const updateAccess = SiteSettings.access?.update

    if (!readAccess || !updateAccess) {
      throw new Error('Site Settings must define read and update access functions.')
    }

    expect(SiteSettings.slug).toBe('site-settings')
    expect(await readAccess(guestRequest as never)).toBe(
      anyone(guestRequest as never),
    )
    expect(await updateAccess(guestRequest as never)).toBe(
      authenticated(guestRequest as never),
    )
    expect(await updateAccess(authenticatedRequest as never)).toBe(
      authenticated(authenticatedRequest as never),
    )
    expect(SiteSettings.admin?.group).toBe('Settings')
    expect(SiteSettings.fields).toContain(siteSettingsTabs)
    expect(Object.values(SiteSettings.hooks ?? {}).every((hooks) => hooks.length === 0)).toBe(true)
    expect(SiteSettings.versions).toBe(false)
  })

  it('is registered in the root Payload config', async () => {
    const config = await configPromise
    expect(config.globals.some((global) => global.slug === SiteSettings.slug)).toBe(true)
  })

  it('accepts only absolute HTTP and HTTPS social URLs', () => {
    expect(validateAbsoluteHttpURL('https://www.linkedin.com/company/ecolitea')).toBe(true)
    expect(validateAbsoluteHttpURL('http://example.com/profile')).toBe(true)
    expect(validateAbsoluteHttpURL(undefined)).toBe('This field is required.')
    expect(validateAbsoluteHttpURL('')).toBe('This field is required.')
    expect(validateAbsoluteHttpURL('/relative-profile')).toBe(
      'Enter a complete URL beginning with http:// or https://.',
    )
    expect(validateAbsoluteHttpURL('https:example.com')).toBe(
      'Enter a complete URL beginning with http:// or https://.',
    )
    expect(validateAbsoluteHttpURL('https:/example.com')).toBe(
      'Enter a complete URL beginning with http:// or https://.',
    )
    expect(validateAbsoluteHttpURL('javascript:alert(1)')).toBe(
      'Enter a complete URL beginning with http:// or https://.',
    )
  })
})
