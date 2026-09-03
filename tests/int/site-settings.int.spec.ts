import { describe, expect, expectTypeOf, it, vi } from 'vitest'
import type { AccessArgs, PayloadRequest } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import {
  SocialPlatforms,
  validateSocialPlatformIcon,
} from '@/collections/SocialPlatforms'
import { seedSocialSettings } from '@/endpoints/seed'
import { SiteSettings } from '@/SiteSettings/config'
import {
  siteSettingsTabs,
  validateAbsoluteHttpURL,
} from '@/SiteSettings/fields'
import { brandingTab } from '@/SiteSettings/fields/branding'
import { socialTab } from '@/SiteSettings/fields/social'
import { revalidateSiteSettings } from '@/SiteSettings/hooks/revalidateSiteSettings'
import type {
  Config,
  SiteSettings as GeneratedSiteSettings,
  SocialPlatform,
  User,
} from '@/payload-types'

type GeneratedSocialLink = NonNullable<GeneratedSiteSettings['socialLinks']>[number]

const createSeedPayload = ({
  brandAssets = [],
  siteSettings = { id: 'site-settings' },
  socialPlatforms = [],
}: {
  brandAssets?: Record<string, unknown>[]
  siteSettings?: Record<string, unknown>
  socialPlatforms?: Record<string, unknown>[]
} = {}) => {
  const state = {
    brandAssets: [...brandAssets],
    siteSettings: { ...siteSettings },
    socialPlatforms: [...socialPlatforms],
  }

  const payload = {
    create: vi.fn(async ({ collection, data, file }) => {
      const target = collection === 'brand-assets' ? state.brandAssets : state.socialPlatforms
      const document = {
        id: `${collection}-${target.length + 1}`,
        ...data,
        ...(file ? { file, filename: file.name, mimeType: file.mimetype } : {}),
      }
      target.push(document)
      return document
    }),
    find: vi.fn(async ({ collection, where }) => {
      if (collection === 'brand-assets') {
        return {
          docs: state.brandAssets.filter(
            (asset) => asset.filename === where.filename.equals,
          ),
        }
      }

      const [platformCondition, iconCondition] = where.and
      return {
        docs: state.socialPlatforms.filter(
          (platform) =>
            platform.platform === platformCondition.platform.equals &&
            platform.icon === iconCondition.icon.equals,
        ),
      }
    }),
    findGlobal: vi.fn(async () => state.siteSettings),
    logger: { info: vi.fn() },
    updateGlobal: vi.fn(async ({ data }) => {
      state.siteSettings = { ...state.siteSettings, ...data }
      return state.siteSettings
    }),
  }

  return { payload, state }
}

describe('Site Settings Global', () => {
  it('generates reusable social platform relationship types', () => {
    expectTypeOf<Config['collections']['social-platforms']>().toEqualTypeOf<SocialPlatform>()
    expectTypeOf<GeneratedSocialLink['platform']>().toEqualTypeOf<string | SocialPlatform>()
  })

  it('seeds valid SVG social relationships on a fresh database and is idempotent', async () => {
    const { payload, state } = createSeedPayload()

    const firstResult = await seedSocialSettings(payload as never)
    const secondResult = await seedSocialSettings(payload as never)

    expect(state.brandAssets).toHaveLength(4)
    expect(state.socialPlatforms).toHaveLength(3)
    expect(payload.create).toHaveBeenCalledTimes(7)
    expect(payload.create.mock.calls.map(([input]) => input.collection)).toEqual([
      'brand-assets',
      'brand-assets',
      'brand-assets',
      'brand-assets',
      'social-platforms',
      'social-platforms',
      'social-platforms',
    ])
    expect(
      payload.create.mock.calls
        .filter(([input]) => input.collection === 'brand-assets')
        .every(([input]) => input.file.mimetype === 'image/svg+xml'),
    ).toBe(true)
    expect(state.siteSettings).toMatchObject({
      siteName: 'Ecolitea',
      logo: 'brand-assets-1',
      socialLinks: [
        { platform: 'social-platforms-1' },
        { platform: 'social-platforms-2' },
        { platform: 'social-platforms-3' },
      ],
    })
    expect(secondResult).toEqual(firstResult)
  })

  it('preserves user records and existing Site Settings branding while reseeding social links', async () => {
    const userAsset = { id: 'user-asset', filename: 'customer-logo.svg' }
    const userPlatform = { id: 'user-platform', platform: 'LinkedIn', icon: 'user-asset' }
    const { payload, state } = createSeedPayload({
      brandAssets: [userAsset],
      siteSettings: { id: 'site-settings', siteName: 'Customer Name', logo: 'user-asset' },
      socialPlatforms: [userPlatform],
    })

    const result = await seedSocialSettings(payload as never)

    expect(state.brandAssets).toContainEqual(userAsset)
    expect(state.socialPlatforms).toContainEqual(userPlatform)
    expect(state.brandAssets).toHaveLength(5)
    expect(state.socialPlatforms).toHaveLength(4)
    expect(result).toMatchObject({ siteName: 'Customer Name', logo: 'user-asset' })
    expect(result.socialLinks).toHaveLength(3)
    expect(result.socialLinks?.every(({ platform }) => platform !== 'user-platform')).toBe(true)
  })

  it('rejects a malformed file occupying a reserved seed asset filename', async () => {
    const { payload } = createSeedPayload({
      brandAssets: [
        {
          id: 'malformed-reserved-asset',
          filename: 'payload-seed-ecolitea-logo.svg',
          mimeType: 'image/png',
        },
      ],
    })

    await expect(seedSocialSettings(payload as never)).rejects.toThrow(
      'Reserved seed asset payload-seed-ecolitea-logo.svg exists with MIME type image/png; expected image/svg+xml.',
    )
    expect(payload.create).not.toHaveBeenCalled()
  })

  it('defines a hidden reusable Social Platforms collection', () => {
    expect(SocialPlatforms).toMatchObject({
      slug: 'social-platforms',
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
      {
        name: 'platform',
        type: 'text',
        required: true,
      },
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
    expect(
      config.collections.some((collection) => collection.slug === SocialPlatforms.slug),
    ).toBe(true)
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
        allowCreate: false,
        components: {
          Field:
            '@/SiteSettings/components/SocialPlatformRelationshipField#SocialPlatformRelationshipField',
        },
      },
    })
    expect(label).toMatchObject({ name: 'label', type: 'text' })
    expect(url).toMatchObject({ name: 'url', type: 'text', required: true })

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
})
