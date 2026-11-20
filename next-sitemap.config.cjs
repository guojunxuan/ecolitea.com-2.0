const SITE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  'https://example.com'

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: SITE_URL,
  sourceDir: process.env.PLAYWRIGHT_TEST === 'true' ? '.next-e2e' : '.next',
  generateRobotsTxt: true,
  exclude: [
    '/pages-sitemap.xml',
    '/blogs-sitemap.xml',
    '/products-sitemap.xml',
    '/*',
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: '*',
        disallow: '/admin/*',
      },
    ],
    additionalSitemaps: [
      `${SITE_URL}/pages-sitemap.xml`,
      `${SITE_URL}/blogs-sitemap.xml`,
      `${SITE_URL}/products-sitemap.xml`,
    ],
  },
}
