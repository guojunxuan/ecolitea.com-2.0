import { expect, it } from 'vitest'
import { getRedirectUrl, unstable_getResponseFromNextConfig } from 'next/experimental/testing/server'
import { redirects } from '../../redirects'

const origin = 'https://example.test'
const resolve = (path: string) =>
  unstable_getResponseFromNextConfig({ url: `${origin}${path}`, nextConfig: { redirects } })

it.each([
  ['/posts', '/blogs'],
  ['/posts/page/3?preview=1', '/blogs?preview=1'],
  ['/de/posts', '/de/blogs'],
  ['/zh-Hant/posts/legacy/entry', '/zh-Hant/blogs'],
  ['/en/posts/old-article', '/en/blogs'],
])('permanently redirects %s to %s', async (source, destination) => {
  const response = await resolve(source)
  expect(response.status).toBe(301)
  expect(getRedirectUrl(response)).toBe(`${origin}${destination}`)
})

it.each(['/admin/posts', '/products/posts/article', '/123/posts', '/de-too-long-a-part/posts'])(
  'does not treat %s as a localized legacy Posts path',
  async (source) => {
    expect((await resolve(source)).headers.get('location')).toBeNull()
  },
)
