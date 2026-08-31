import { describe, expect, it } from 'vitest'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
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

  it('registers the expected Global identity and shared access functions', () => {
    expect(SiteSettings.slug).toBe('site-settings')
    expect(SiteSettings.access?.read).toBe(anyone)
    expect(SiteSettings.access?.update).toBe(authenticated)
    expect(SiteSettings.fields).toEqual([siteSettingsTabs])
    expect(SiteSettings.hooks).toBeUndefined()
  })

  it('accepts only absolute HTTP and HTTPS social URLs', () => {
    expect(validateAbsoluteHttpURL('https://www.linkedin.com/company/ecolitea')).toBe(true)
    expect(validateAbsoluteHttpURL('http://example.com/profile')).toBe(true)
    expect(validateAbsoluteHttpURL('/relative-profile')).toBe(
      'Enter a complete URL beginning with http:// or https://.',
    )
    expect(validateAbsoluteHttpURL('javascript:alert(1)')).toBe(
      'Enter a complete URL beginning with http:// or https://.',
    )
  })
})
