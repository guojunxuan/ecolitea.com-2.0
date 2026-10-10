import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollapsibleField, GroupField, PayloadRequest, TextField, UploadField } from 'payload'
import { validations } from 'payload'

import { anyone } from '@/access/anyone'
import { authenticated } from '@/access/authenticated'
import { MEDIA_UPLOAD_POLICY } from '@/collections/mediaUploadPolicy'
import { Settings } from '@/Settings/config'
import { settingsTabs } from '@/Settings/fields'
import { blogTab } from '@/Settings/fields/blog'
import { trimText, validateEnabledHeading } from '@/Settings/fields/validation'
import { revalidateSettings } from '@/Settings/hooks/revalidateSettings'
import { revalidatePath, revalidateTag } from 'next/cache'
import { generateDescription, generateTitle, generateURL } from '@/plugins'
import { getServerSideURL } from '@/utilities/getURL'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

const listing = blogTab.fields[0] as GroupField
const heroSection = listing.fields[0] as CollapsibleField
const seoSection = listing.fields[1] as CollapsibleField
const hero = heroSection.fields[0] as GroupField
const seo = seoSection.fields[0] as GroupField

const validateHeading = (value: string, enabled: boolean) =>
  validateEnabledHeading(value, {
    siblingData: { enabled },
    req: { payload: { config: {} }, t: () => 'Native validation error' },
  } as never)

describe('Settings Global', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defines the public, authenticated-update unversioned global', () => {
    expect(Settings).toMatchObject({
      slug: 'settings',
      label: 'Settings',
      typescript: { interface: 'Settings' },
      access: { read: anyone, update: authenticated },
      versions: false,
      fields: [settingsTabs],
      hooks: { afterChange: [revalidateSettings] },
    })
  })

  it('organizes Hero and SEO as collapsible Blog sections', () => {
    expect(settingsTabs).toEqual({ type: 'tabs', tabs: [blogTab] })
    expect(blogTab).toMatchObject({ name: 'blog', label: 'Blog' })
    expect(listing).toMatchObject({ name: 'listing', label: false, type: 'group', admin: { hideGutter: true } })
    expect(heroSection).toMatchObject({ type: 'collapsible', label: 'Hero', admin: { initCollapsed: false } })
    expect(seoSection).toMatchObject({ type: 'collapsible', label: 'SEO', admin: { initCollapsed: true } })
    expect(hero).toMatchObject({ name: 'hero', label: false, type: 'group' })
    expect(hero.fields.map((field) => 'name' in field && field.name)).toEqual([
      'enabled',
      'heading',
      'description',
      'image',
      'headerTheme',
    ])
    expect(hero.fields[0]).toMatchObject({ type: 'checkbox', defaultValue: false })
    expect(hero.fields[1]).toMatchObject({
      type: 'text',
      hooks: { beforeValidate: [trimText] },
      validate: validateEnabledHeading,
    })
    expect(hero.fields[2]).toMatchObject({
      type: 'textarea',
      hooks: { beforeValidate: [trimText] },
    })
    expect(hero.fields[3]).toMatchObject({ type: 'upload', relationTo: 'media' })
    expect((hero.fields[3] as UploadField).filterOptions).toEqual({
      mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] },
    })
    expect(hero.fields[4]).toMatchObject({
      type: 'select',
      required: true,
      defaultValue: 'light',
      options: [
        { label: 'Light', value: 'light' },
        { label: 'Dark', value: 'dark' },
      ],
      admin: {
        description:
          'Use Dark for dark images (white text and header), Light for bright images or no image.',
      },
    })
    expect((hero.fields[1] as TextField).required).toBeFalsy()
    expect((hero.fields[2] as TextField).required).toBeFalsy()
    expect((hero.fields[3] as UploadField).required).toBeFalsy()
    for (const field of hero.fields.slice(1)) {
      const condition = field.admin?.condition
      expect(condition?.({}, { enabled: true }, {} as never)).toBe(true)
      expect(condition?.({}, { enabled: false }, {} as never)).toBe(false)
      expect(condition?.({}, {}, {} as never)).toBe(false)
    }
  })

  it('places reusable SEO plugin fields beside Hero with nested paths', () => {
    expect(heroSection.fields.map((field) => 'name' in field && field.name)).toEqual(['hero'])
    expect(seoSection.fields.map((field) => 'name' in field && field.name)).toEqual(['seo'])
    expect(seo).toMatchObject({ name: 'seo', label: false, type: 'group' })
    expect(seo.fields.map((field) => 'name' in field && field.name)).toEqual([
      'overview',
      'title',
      'description',
      'image',
      'preview',
    ])
    expect(seo.fields[0]).toMatchObject({
      admin: { components: { Field: { clientProps: {
        titlePath: 'blog.listing.seo.title',
        descriptionPath: 'blog.listing.seo.description',
        imagePath: 'blog.listing.seo.image',
      } } } },
    })
    expect(seo.fields[1]).toMatchObject({ hooks: { beforeValidate: [trimText] } })
    expect(seo.fields[2]).toMatchObject({ hooks: { beforeValidate: [trimText] } })
    expect(seo.fields[3]).toMatchObject({ type: 'upload', relationTo: 'media' })
    expect((seo.fields[3] as UploadField).filterOptions).toEqual({
      mimeType: { in: [...MEDIA_UPLOAD_POLICY.image.mimeTypes] },
    })
    expect(seo.fields[4]).toMatchObject({
      admin: { components: { Field: { clientProps: {
        titlePath: 'blog.listing.seo.title',
        descriptionPath: 'blog.listing.seo.description',
        hasGenerateURLFn: true,
      } } } },
    })
  })

  it('generates listing defaults for Settings without changing article generators', () => {
    const settings = { globalConfig: { slug: 'settings' }, doc: {} } as never
    expect(generateTitle(settings)).toBe('Blogs')
    expect(generateDescription(settings)).toBe('Explore our latest blog articles, insights, and guides.')
    expect(generateURL(settings)).toBe(`${getServerSideURL()}/blogs`)
    const article = { collectionConfig: { slug: 'blogs' }, doc: { title: 'Tea', excerpt: 'Leaves' } } as never
    expect(generateTitle(article)).toBe('Tea | Ecolitea')
    expect(generateDescription(article)).toBe('Leaves')
    expect(generateURL({ collectionConfig: { slug: 'blogs' }, doc: { slug: 'tea' } } as never))
      .toBe(`${getServerSideURL()}/blogs/tea`)
  })

  it.each([
    ['  ', true, 'Heading is required when the Hero is enabled.'],
    [' Content ', true, true],
    ['', false, true],
    [' Saved heading ', false, true],
  ] as const)('validates heading %j when enabled=%s', (value, enabled, expected) => {
    expect(validateHeading(value, enabled)).toBe(expected)
  })

  it('preserves native text validation errors', () => {
    const native = vi.spyOn(validations, 'text').mockReturnValueOnce('Native error')
    expect(validateHeading('content', true)).toBe('Native error')
    native.mockRestore()
  })

  it('trims strings and preserves nonstring values', () => {
    expect(trimText({ value: ' text ' } as never)).toBe('text')
    expect(trimText({ value: null } as never)).toBeNull()
  })

  it.each([false, true])(
    'revalidates unless disabled=%s and returns the document',
    (disableRevalidate) => {
      const doc = { blog: { listing: { hero: { enabled: false, heading: 'Saved' } } } }
      const result = revalidateSettings({
        doc,
        req: { context: { disableRevalidate } } as unknown as PayloadRequest,
      } as never)
      expect(result).toBe(doc)
      if (disableRevalidate) {
        expect(revalidateTag).not.toHaveBeenCalled()
        expect(revalidatePath).not.toHaveBeenCalled()
      } else {
        expect(revalidateTag).toHaveBeenCalledExactlyOnceWith('global_settings', 'max')
        expect(revalidatePath).toHaveBeenCalledWith('/blogs')
        expect(revalidatePath).toHaveBeenCalledWith('/blogs/page/[pageNumber]', 'page')
      }
    },
  )
})

describe('Settings SEO image write integrity', () => {
  it('rejects a video relationship on an explicit write', async () => {
    const findByID = vi.fn().mockResolvedValue({ mimeType: 'video/mp4' })
    const hook = Settings.hooks?.beforeChange?.[1]
    expect(hook).toBeTypeOf('function')
    await expect(hook!({ data: { blog: { listing: { seo: { image: 'video-id' } } } }, req: { payload: { findByID } } } as never))
      .rejects.toMatchObject({ status: 400, data: { errors: [{ path: 'blog.listing.seo.image' }] } })
  })

  it('validates retained images on partial updates and preserves other data', async () => {
    const findByID = vi.fn().mockResolvedValue({ mimeType: 'image/png' })
    const data = { blog: { listing: { hero: { enabled: false } } } }
    const hook = Settings.hooks?.beforeChange?.[1]
    await expect(hook!({ data, originalDoc: { blog: { listing: { seo: { image: 'image-id' } } } }, req: { payload: { findByID } } } as never))
      .resolves.toBe(data)
    expect(findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'media', id: 'image-id', depth: 0 }))
  })

  it('allows clearing an optional image', async () => {
    const findByID = vi.fn()
    const data = { blog: { listing: { seo: { image: null } } } }
    const hook = Settings.hooks?.beforeChange?.[1]
    await expect(hook!({ data, originalDoc: { blog: { listing: { seo: { image: 'old' } } } }, req: { payload: { findByID } } } as never))
      .resolves.toBe(data)
    expect(findByID).not.toHaveBeenCalled()
  })
})

// Run the Global hook itself: this boundary must protect API writes even when
// Payload skips hidden field validation because the Hero is disabled.
describe('Settings Hero image write integrity', () => {
  it.each([true, false])('rejects video relationships when enabled=%s', async (enabled) => {
    const findByID = vi.fn().mockResolvedValue({ id: 'video-id', mimeType: 'video/mp4' })
    const hook = Settings.hooks?.beforeChange?.[0]
    expect(hook).toBeTypeOf('function')
    await expect(
      hook!({
        data: { blog: { listing: { hero: { enabled, image: 'video-id' } } } },
        req: { payload: { findByID } },
      } as never),
    ).rejects.toMatchObject({
      status: 400,
      data: {
        errors: [
          { path: 'blog.listing.hero.image', message: 'Hero image must be an image from Media.' },
        ],
      },
    })
  })

  it('preserves a valid inactive image and checks stored Media metadata', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 'image-id', mimeType: 'image/png' })
    const data = {
      blog: {
        listing: { hero: { enabled: false, image: { id: 'image-id', mimeType: 'video/mp4' } } },
      },
    }
    const hook = Settings.hooks?.beforeChange?.[0]
    expect(hook).toBeTypeOf('function')
    await expect(hook!({ data, req: { payload: { findByID } } } as never)).resolves.toBe(data)
    expect(findByID).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'media', id: 'image-id', depth: 0 }),
    )
  })

  it('validates a retained relationship on a partial update without removing data', async () => {
    const findByID = vi.fn().mockResolvedValue({ id: 'image-id', mimeType: 'image/jpeg' })
    const data = { blog: { listing: { hero: { enabled: false } } } }
    const originalDoc = { blog: { listing: { hero: { image: 'image-id' } } } }
    const hook = Settings.hooks?.beforeChange?.[0]
    expect(hook).toBeTypeOf('function')
    await expect(
      hook!({ data, originalDoc, req: { payload: { findByID } } } as never),
    ).resolves.toBe(data)
    expect(findByID).toHaveBeenCalledOnce()
  })

  it('allows an explicitly cleared optional image', async () => {
    const findByID = vi.fn()
    const data = { blog: { listing: { hero: { image: null } } } }
    const hook = Settings.hooks?.beforeChange?.[0]
    expect(hook).toBeTypeOf('function')
    await expect(
      hook!({
        data,
        originalDoc: { blog: { listing: { hero: { image: 'old' } } } },
        req: { payload: { findByID } },
      } as never),
    ).resolves.toBe(data)
    expect(findByID).not.toHaveBeenCalled()
  })
})
