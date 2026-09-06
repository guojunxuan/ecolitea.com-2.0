import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { AccessArgs, PayloadRequest } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import {
  SocialPlatforms,
  preventSocialPlatformRename,
  validateSocialPlatformIcon,
} from '@/collections/SocialPlatforms'
import { SiteSettings } from '@/SiteSettings/config'
import { siteSettingsTabs, validateAbsoluteHttpURL } from '@/SiteSettings/fields'
import { brandingTab } from '@/SiteSettings/fields/branding'
import { socialTab, validateUniqueSocialPlatforms } from '@/SiteSettings/fields/social'
import { revalidateSiteSettings } from '@/SiteSettings/hooks/revalidateSiteSettings'
import type {
  Config,
  SiteSettings as GeneratedSiteSettings,
  SocialPlatform,
  User,
} from '@/payload-types'

type GeneratedSocialLink = NonNullable<GeneratedSiteSettings['socialLinks']>[number]

describe('Site Settings Global', () => {
  it('generates reusable social platform relationship types', () => {
    expectTypeOf<Config['collections']['social-platforms']>().toEqualTypeOf<SocialPlatform>()
    expectTypeOf<GeneratedSocialLink['platform']>().toEqualTypeOf<string | SocialPlatform>()
  })

  it('defines a hidden reusable Social Platforms collection', () => {
    expect(SocialPlatforms).toMatchObject({
      slug: 'social-platforms',
      disableDuplicate: true,
      admin: {
        hidden: true,
        useAsTitle: 'platform',
      },
      access: {
        create: authenticated,
        delete: authenticated,
        read: anyone,
        update: authenticated,
      },
    })
    expect(SocialPlatforms.fields).toEqual([
      expect.objectContaining({
        name: 'platform',
        type: 'text',
        required: true,
        unique: true,
        admin: expect.objectContaining({
          components: {
            Field: '@/SiteSettings/components/SocialPlatformNameField#SocialPlatformNameField',
          },
        }),
      }),
      expect.objectContaining({
        name: 'icon',
        type: 'upload',
        relationTo: 'brand-assets',
        required: true,
        filterOptions: { mimeType: { equals: 'image/svg+xml' } },
        validate: validateSocialPlatformIcon,
      }),
    ])
  })

  it('enforces SVG social platform icons on the server', async () => {
    const findByID = vi.fn()
    const req = { payload: { findByID } } as unknown as PayloadRequest

    findByID.mockResolvedValueOnce({ mimeType: 'image/svg+xml' })
    await expect(validateSocialPlatformIcon('asset-id', { req } as never)).resolves.toBe(true)

    findByID.mockResolvedValueOnce({ mimeType: 'image/png' })
    await expect(validateSocialPlatformIcon('asset-id', { req } as never)).resolves.toBe(
      'Social platform icons must be SVG files.',
    )
    expect(findByID).toHaveBeenCalledWith({
      collection: 'brand-assets',
      id: 'asset-id',
      req,
    })

    await expect(validateSocialPlatformIcon(null, { req } as never)).resolves.toBe(
      'An SVG icon is required.',
    )
    findByID.mockRejectedValueOnce(new Error('not found'))
    await expect(validateSocialPlatformIcon('missing', { req } as never)).resolves.toBe(
      'Select an existing SVG brand asset.',
    )
  })

  it('prevents changing a social platform name after creation', () => {
    expect(() =>
      preventSocialPlatformRename({
        operation: 'update',
        originalDoc: { platform: 'GitHub' },
        value: 'X',
      } as never),
    ).toThrow('Platform cannot be changed after creation.')
    expect(
      preventSocialPlatformRename({
        operation: 'update',
        originalDoc: { platform: 'GitHub' },
        value: 'GitHub',
      } as never),
    ).toBe('GitHub')
  })

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
    expect(SiteSettings.admin?.group).toBeUndefined()
    expect(SiteSettings.fields).toEqual([siteSettingsTabs])
    expect(SiteSettings.hooks?.afterChange).toEqual([revalidateSiteSettings])
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
    expect(config.collections.some((collection) => collection.slug === SocialPlatforms.slug)).toBe(
      true,
    )
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

  it('relates social links to reusable social platforms', () => {
    const socialLinks = socialTab.fields.find(
      (field) => 'name' in field && field.name === 'socialLinks',
    )

    expect(socialLinks).toMatchObject({ name: 'socialLinks', type: 'array' })
    if (!socialLinks || socialLinks.type !== 'array') {
      throw new Error('Social tab must define a socialLinks array.')
    }

    const platform = socialLinks.fields.find(
      (field) => 'name' in field && field.name === 'platform',
    )
    const label = socialLinks.fields.find((field) => 'name' in field && field.name === 'label')
    const url = socialLinks.fields.find((field) => 'name' in field && field.name === 'url')

    expect(platform).toMatchObject({
      name: 'platform',
      type: 'relationship',
      relationTo: 'social-platforms',
      required: true,
      admin: {
        allowCreate: true,
      },
    })
    expect(label).toBeUndefined()
    expect(url).toMatchObject({ name: 'url', type: 'text', required: true })
    expect(socialLinks.admin?.components?.RowLabel).toBe(
      '@/SiteSettings/components/SocialLinkRowLabel#SocialLinkRowLabel',
    )
    expect(socialLinks.admin?.components?.Field).toBe(
      '@/SiteSettings/components/SocialLinksArrayField#SocialLinksArrayField',
    )
    expect(socialLinks.validate).toBe(validateUniqueSocialPlatforms)

    const createSocialPlatform = socialTab.fields.find(
      (field) => 'name' in field && field.name === 'createSocialPlatform',
    )
    expect(createSocialPlatform).toMatchObject({
      name: 'createSocialPlatform',
      type: 'ui',
      admin: {
        components: {
          Field:
            '@/SiteSettings/components/SocialPlatformCreateActions#SocialPlatformCreateActions',
        },
      },
    })
  })

  it('rejects duplicate platform relationships within Social Links', () => {
    expect(validateUniqueSocialPlatforms(undefined)).toBe(true)
    expect(validateUniqueSocialPlatforms([{ platform: 'github' }, { platform: 'x' }])).toBe(true)
    expect(
      validateUniqueSocialPlatforms([
        { platform: { id: 'github', platform: 'GitHub' } },
        { platform: 'github' },
      ]),
    ).toBe(
      'Platform "GitHub" is already selected in Social Link row 1 and cannot be selected again in row 2.',
    )
    expect(
      validateUniqueSocialPlatforms([{ platform: 'opaque-id' }, { platform: 'opaque-id' }]),
    ).toBe(
      'This Platform is already selected in Social Link row 1 and cannot be selected again in row 2.',
    )
  })
})
