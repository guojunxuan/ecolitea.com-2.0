import { describe, expect, it, vi } from 'vitest'
import { planBlogSettingsMove, up } from '@/migrations/20261015_flat_blog_settings'

describe('Blog settings migration', () => {
  const old = {
    globalType: 'settings',
    blog: {
      listing: {
        hero: { enabled: true, heading: 'Stories' },
        seo: { title: 'Journal' },
      },
      article: { share: { copyLink: false, platforms: [{ name: 'Email' }] } },
    },
  }

  it('moves stored values to direct Blog fields and removes only empty legacy groups', () => {
    expect(planBlogSettingsMove(old, 'up')).toEqual({
      set: {
        'blog.hero': old.blog.listing.hero,
        'blog.seo': old.blog.listing.seo,
        'blog.share': old.blog.article.share,
      },
      unset: { 'blog.listing': '', 'blog.article': '' },
    })
  })

  it('preserves unrelated legacy values and refuses to overwrite a destination', () => {
    expect(
      planBlogSettingsMove({ blog: { listing: { hero: old.blog.listing.hero, extra: 1 } } }, 'up'),
    ).toEqual({ set: { 'blog.hero': old.blog.listing.hero }, unset: { 'blog.listing.hero': '' } })
    expect(() => planBlogSettingsMove({ blog: { listing: { hero: {} }, hero: {} } }, 'up')).toThrow(
      'blog.hero already exists',
    )
  })

  it('reverses the same values without overwriting legacy data', () => {
    const flat = {
      blog: {
        hero: old.blog.listing.hero,
        seo: old.blog.listing.seo,
        share: old.blog.article.share,
      },
    }
    expect(planBlogSettingsMove(flat, 'down')).toEqual({
      set: {
        'blog.listing.hero': old.blog.listing.hero,
        'blog.listing.seo': old.blog.listing.seo,
        'blog.article.share': old.blog.article.share,
      },
      unset: { 'blog.hero': '', 'blog.seo': '', 'blog.share': '' },
    })
  })

  it('updates only the Settings document in the globals collection', async () => {
    const updateOne = vi.fn()
    const collection = vi.fn().mockReturnValue({
      findOne: vi.fn().mockResolvedValue({ _id: 'settings-id', ...old }),
      updateOne,
    })
    const payload = {
      db: {
        connection: {
          db: { databaseName: 'local-test', collection },
          host: '127.0.0.1',
          port: 27017,
        },
      },
      logger: { info: vi.fn() },
    }
    await up({ payload } as never)
    expect(collection).toHaveBeenCalledExactlyOnceWith('globals')
    expect(updateOne).toHaveBeenCalledExactlyOnceWith(
      { _id: 'settings-id', globalType: 'settings' },
      {
        $set: expect.objectContaining({
          'blog.hero': old.blog.listing.hero,
          'blog.share': old.blog.article.share,
        }),
        $unset: { 'blog.listing': '', 'blog.article': '' },
      },
    )
  })
})
