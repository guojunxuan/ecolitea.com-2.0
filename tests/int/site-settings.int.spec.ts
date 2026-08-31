import { describe, expect, it } from 'vitest'
import type { AccessArgs, PayloadRequest } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { SiteSettings } from '@/SiteSettings/config'
import {
  siteSettingsTabs,
  validateAbsoluteHttpURL,
} from '@/SiteSettings/fields'
import { brandingTab } from '@/SiteSettings/fields/branding'
import type { User } from '@/payload-types'

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
    const guestRequest = { payload: { config: {} } } as PayloadRequest
    const authenticatedRequest = {
      payload: { config: {} },
      user: {} as User,
    } as PayloadRequest
    const guestAccessArgs: AccessArgs = { req: guestRequest, slug: 'site-settings' }
    const authenticatedAccessArgs: AccessArgs = {
      req: authenticatedRequest,
      slug: 'site-settings',
    }
    const readAccess = SiteSettings.access?.read
    const updateAccess = SiteSettings.access?.update

    expect(readAccess).toBe(anyone)
    expect(updateAccess).toBe(authenticated)

    if (!readAccess || !updateAccess) {
      throw new Error('Site Settings must define read and update access functions.')
    }

    expect(SiteSettings.slug).toBe('site-settings')
    expect(SiteSettings.typescript?.interface).toBe('SiteSettings')
    expect(await readAccess(guestAccessArgs)).toBe(true)
    expect(await updateAccess(guestAccessArgs)).toBe(false)
    expect(await updateAccess(authenticatedAccessArgs)).toBe(true)
    expect(SiteSettings.admin?.group).toBe('Settings')
    expect(SiteSettings.fields).toEqual([siteSettingsTabs])
    expect(SiteSettings.hooks).toBeUndefined()
    expect(SiteSettings.versions).toBe(false)
  })

  it('uses the dedicated brand asset store and filters each branding purpose', () => {
    const [logo, logoDark, favicon] = brandingTab.fields

    expect(logo).toMatchObject({
      name: 'logo',
      type: 'upload',
      relationTo: 'brand-assets',
      required: true,
      filterOptions: { mimeType: { equals: 'image/svg+xml' } },
    })
    expect(logoDark).toMatchObject({
      name: 'logoDark',
      type: 'upload',
      relationTo: 'brand-assets',
      filterOptions: { mimeType: { equals: 'image/svg+xml' } },
    })
    expect(favicon).toMatchObject({
      name: 'favicon',
      type: 'upload',
      relationTo: 'brand-assets',
      filterOptions: {
        mimeType: {
          in: ['image/svg+xml', 'image/png', 'image/x-icon', 'image/vnd.microsoft.icon'],
        },
      },
    })
  })

  it('is registered in the root Payload config', async () => {
    const { default: configPromise } = await import('@/payload.config')
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
