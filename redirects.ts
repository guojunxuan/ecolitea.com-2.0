import type { NextConfig } from 'next'

export const redirects: NextConfig['redirects'] = async () => {
  const internetExplorerRedirect = {
    destination: '/ie-incompatible.html',
    has: [
      {
        type: 'header' as const,
        key: 'user-agent',
        value: '(.*Trident.*)', // all ie browsers
      },
    ],
    permanent: false,
    source: '/:path((?!ie-incompatible.html$).*)', // all pages except the incompatibility page
  }

  const localizedPosts = '/:lang([a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?)/posts'

  return [
    { source: '/posts', destination: '/blogs', statusCode: 301 },
    { source: '/posts/:path*', destination: '/blogs', statusCode: 301 },
    { source: localizedPosts, destination: '/:lang/blogs', statusCode: 301 },
    { source: `${localizedPosts}/:path*`, destination: '/:lang/blogs', statusCode: 301 },
    { source: '/en', destination: '/', statusCode: 301 },
    { source: '/en/:path*', destination: '/:path*', statusCode: 301 },
    internetExplorerRedirect,
  ]
}
