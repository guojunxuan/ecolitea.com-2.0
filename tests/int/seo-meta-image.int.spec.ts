import { describe, expect, it, vi } from 'vitest'

import { generateImage } from '@/plugins'
import { blogTab } from '@/Settings/fields/blog'
import { Blogs } from '@/collections/Blogs'
import { Posts } from '@/collections/Posts'
import { Pages } from '@/collections/Pages'
import { CaseStudies } from '@/collections/CaseStudies'
import type { Field } from 'payload'

const findImageField = (fields: Field[]): Field | undefined => {
  for (const field of fields) {
    if ('name' in field && field.name === 'meta' && 'fields' in field) {
      return field.fields.find((child) => 'name' in child && child.name === 'image')
    }
    if ('fields' in field && Array.isArray(field.fields)) {
      const result = findImageField(field.fields)
      if (result) return result
    }
    if (field.type === 'tabs') {
      for (const tab of field.tabs) {
        if ('name' in tab && tab.name === 'meta') {
          return tab.fields.find((child) => 'name' in child && child.name === 'image')
        }
        const result = findImageField(tab.fields)
        if (result) return result
      }
    }
  }
  return undefined
}

const request = (mimeType = 'image/jpeg') => ({
  payload: { findByID: vi.fn().mockResolvedValue({ id: 'source-image', mimeType }) },
})

describe('SEO Meta Image auto-generation', () => {
  it.each([Blogs, Posts, Pages, CaseStudies])('enables the collection Meta Image button for $slug', (config) => {
    expect(findImageField(config.fields)?.admin?.components?.Field).toMatchObject({
      clientProps: { hasGenerateImageFn: true },
    })
  })

  it('enables the Settings Blog Meta Image button', () => {
    const listing = blogTab.fields[0]
    const seoSection = 'fields' in listing && listing.fields[1]
    const seoGroup = seoSection && 'fields' in seoSection && seoSection.fields[0]
    const image = seoGroup && 'fields' in seoGroup && seoGroup.fields.find((field) => 'name' in field && field.name === 'image')
    expect(image && image.admin?.components?.Field).toMatchObject({ clientProps: { hasGenerateImageFn: true } })
  })

  it.each([
    ['Settings Blog', { globalConfig: { slug: 'settings' }, doc: { blog: { listing: { hero: { image: 'source-image' } } } } }],
    ['Blogs', { collectionConfig: { slug: 'blogs' }, doc: { heroImage: 'source-image' } }],
    ['Posts', { collectionConfig: { slug: 'posts' }, doc: { heroImage: 'source-image' } }],
    ['Pages', { collectionConfig: { slug: 'pages' }, doc: { hero: { type: 'highImpact', media: 'source-image' } } }],
    ['Case Studies', { collectionConfig: { slug: 'case-studies' }, doc: { hero: { type: 'mediumImpact', media: 'source-image' } } }],
  ])('uses the image source for %s', async (_, input) => {
    const req = request()
    expect(await generateImage({ ...input, req } as never)).toBe('source-image')
    expect(req.payload.findByID).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'media', id: 'source-image', depth: 0, overrideAccess: false,
    }))
  })

  it('keeps the current image when the source is a video', async () => {
    const req = request('video/mp4')
    expect(await generateImage({ collectionConfig: { slug: 'posts' }, doc: {
      heroImage: 'source-image', meta: { image: 'existing-image' },
    }, req } as never)).toBe('existing-image')
  })

  it('keeps the nested Settings image when the Hero has no image', async () => {
    const req = request()
    expect(await generateImage({ globalConfig: { slug: 'settings' }, doc: {
      blog: { listing: { seo: { image: 'existing-image' } } },
    }, req } as never)).toBe('existing-image')
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it('accepts a populated Media relation and a disabled Settings Hero', async () => {
    const req = request()
    expect(await generateImage({ globalConfig: { slug: 'settings' }, doc: {
      blog: { listing: { hero: { enabled: false, image: { id: 'source-image' } } } },
    }, req } as never)).toBe('source-image')
  })

  it('keeps the current image when the source Media cannot be read', async () => {
    const req = request()
    req.payload.findByID.mockRejectedValue({ status: 404 })
    expect(await generateImage({ collectionConfig: { slug: 'blogs' }, doc: {
      heroImage: 'source-image', meta: { image: { id: 'existing-image' } },
    }, req } as never)).toBe('existing-image')
  })

  it('does not use media from a hidden Page Hero', async () => {
    const req = request()
    expect(await generateImage({ collectionConfig: { slug: 'pages' }, doc: {
      hero: { type: 'lowImpact', media: 'source-image' }, meta: { image: 'existing-image' },
    }, req } as never)).toBe('existing-image')
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })

  it('returns an empty value when neither source nor existing image is set', async () => {
    expect(await generateImage({ collectionConfig: { slug: 'posts' }, doc: {}, req: request() } as never)).toBe('')
  })

  it('treats an empty upload field as no source', async () => {
    const req = request()
    expect(await generateImage({ collectionConfig: { slug: 'posts' }, doc: {
      heroImage: '', meta: { image: 'existing-image' },
    }, req } as never)).toBe('existing-image')
    expect(req.payload.findByID).not.toHaveBeenCalled()
  })
})
