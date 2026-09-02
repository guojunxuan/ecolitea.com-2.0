import type { CollectionSlug, GlobalSlug, Payload, PayloadRequest, File } from 'payload'

import { contactForm as contactFormData } from './contact-form'
import { contact as contactPageData } from './contact-page'
import { home } from './home'
import { image1 } from './image-1'
import { image2 } from './image-2'
import { imageHero1 } from './image-hero-1'
import { post1 } from './post-1'
import { post2 } from './post-2'
import { post3 } from './post-3'

const collections: CollectionSlug[] = [
  'categories',
  'media',
  'pages',
  'posts',
  'forms',
  'form-submissions',
  'search',
]

const globals = ['header', 'footer'] as const satisfies GlobalSlug[]

const categories = ['Technology', 'News', 'Finance', 'Design', 'Software', 'Engineering']

const svgFile = (name: string, title: string, body: string): File => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><title>${title}</title>${body}</svg>`
  const data = Buffer.from(source)

  return {
    name,
    data,
    mimetype: 'image/svg+xml',
    size: data.byteLength,
  }
}

export const seedSocialSettings = async (payload: Payload) => {
  const assetFixtures = [
    {
      name: 'site-logo',
      alt: 'Ecolitea seed logo',
      file: svgFile(
        'payload-seed-ecolitea-logo.svg',
        'Ecolitea',
        '<rect width="24" height="24" rx="6" fill="#163d2b"/><path d="M6 12c3-6 9-6 12-3-1 6-6 9-12 6 3-1 6-2 9-5-4 2-6 5-6 8" fill="none" stroke="#fff" stroke-width="1.5"/>',
      ),
    },
    {
      name: 'linkedin',
      alt: 'LinkedIn icon',
      file: svgFile(
        'payload-seed-linkedin.svg',
        'LinkedIn',
        '<rect width="24" height="24" rx="3" fill="#0a66c2"/><path fill="#fff" d="M6 9h3v9H6zm1.5-4.5a1.75 1.75 0 1 1 0 3.5 1.75 1.75 0 0 1 0-3.5zM11 9h3v1.2c.8-1 1.8-1.5 3.2-1.5 2.4 0 3.8 1.5 3.8 4.5V18h-3v-4.4c0-1.5-.5-2.3-1.8-2.3-1.4 0-2.2.9-2.2 2.7v4h-3z"/>',
      ),
    },
    {
      name: 'facebook',
      alt: 'Facebook icon',
      file: svgFile(
        'payload-seed-facebook.svg',
        'Facebook',
        '<circle cx="12" cy="12" r="12" fill="#0866ff"/><path fill="#fff" d="M13.8 20v-7h2.4l.4-2.8h-2.8V8.4c0-.8.2-1.4 1.4-1.4h1.5V4.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8.3V13h2.5v7z"/>',
      ),
    },
    {
      name: 'instagram',
      alt: 'Instagram icon',
      file: svgFile(
        'payload-seed-instagram.svg',
        'Instagram',
        '<rect width="24" height="24" rx="6" fill="#e4405f"/><rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="#fff" stroke-width="2"/><circle cx="17" cy="7" r="1" fill="#fff"/>',
      ),
    },
  ] as const
  const platformFixtures = [
    {
      name: 'linkedin',
      platform: 'LinkedIn',
      profileURL: 'https://www.linkedin.com/company/ecolitea',
    },
    {
      name: 'facebook',
      platform: 'Facebook',
      profileURL: 'https://www.facebook.com/ecolitea',
    },
    {
      name: 'instagram',
      platform: 'Instagram',
      profileURL: 'https://www.instagram.com/ecolitea',
    },
  ] as const

  payload.logger.info(`— Resolving seeded brand assets...`)
  const assetsByFixtureName = new Map<string, Awaited<ReturnType<Payload['create']>>>()

  for (const fixture of assetFixtures) {
    const existing = await payload.find({
      collection: 'brand-assets',
      depth: 0,
      limit: 1,
      where: { filename: { equals: fixture.file.name } },
    })
    const asset =
      existing.docs[0] ??
      (await payload.create({
        collection: 'brand-assets',
        data: { alt: fixture.alt },
        file: fixture.file,
      }))
    assetsByFixtureName.set(fixture.name, asset)
  }

  payload.logger.info(`— Resolving seeded social platforms...`)
  const platformsByFixtureName = new Map<string, Awaited<ReturnType<Payload['create']>>>()

  for (const fixture of platformFixtures) {
    const icon = assetsByFixtureName.get(fixture.name)
    if (!icon) throw new Error(`Missing seeded icon for ${fixture.name}`)

    const existing = await payload.find({
      collection: 'social-platforms',
      depth: 0,
      limit: 1,
      where: {
        and: [{ platform: { equals: fixture.platform } }, { icon: { equals: icon.id } }],
      },
    })
    const platform =
      existing.docs[0] ??
      (await payload.create({
        collection: 'social-platforms',
        data: { platform: fixture.platform, icon: icon.id },
      }))
    platformsByFixtureName.set(fixture.name, platform)
  }

  const currentSettings = await payload.findGlobal({ slug: 'site-settings', depth: 0 })
  const fallbackLogo = assetsByFixtureName.get('site-logo')
  if (!fallbackLogo) throw new Error('Missing seeded fallback site logo')

  return payload.updateGlobal({
    slug: 'site-settings',
    data: {
      ...(!currentSettings.siteName ? { siteName: 'Ecolitea' } : {}),
      ...(!currentSettings.logo ? { logo: fallbackLogo.id } : {}),
      socialLinks: platformFixtures.map((fixture) => {
        const platform = platformsByFixtureName.get(fixture.name)
        if (!platform) throw new Error(`Missing seeded social platform for ${fixture.name}`)
        return { platform: platform.id, label: fixture.platform, url: fixture.profileURL }
      }),
    },
  })
}

// Next.js revalidation errors are normal when seeding the database without a server running
// i.e. running `yarn seed` locally instead of using the admin UI within an active app
// The app is not running to revalidate the pages and so the API routes are not available
// These error messages can be ignored: `Error hitting revalidate route for...`
export const seed = async ({
  payload,
  req,
}: {
  payload: Payload
  req: PayloadRequest
}): Promise<void> => {
  payload.logger.info('Seeding database...')

  // we need to clear the media directory before seeding
  // as well as the collections and globals
  // this is because while `yarn seed` drops the database
  // the custom `/api/seed` endpoint does not
  payload.logger.info(`— Clearing collections and globals...`)

  // clear the database
  await Promise.all(
    globals.map((global) =>
      payload.updateGlobal({
        slug: global,
        data: {
          navItems: [],
        },
        depth: 0,
        context: {
          disableRevalidate: true,
        },
      }),
    ),
  )

  await Promise.all(
    collections.map((collection) => payload.db.deleteMany({ collection, req, where: {} })),
  )

  await Promise.all(
    collections
      .filter((collection) => Boolean(payload.collections[collection].config.versions))
      .map((collection) => payload.db.deleteVersions({ collection, req, where: {} })),
  )

  payload.logger.info(`— Seeding demo author and user...`)

  await payload.delete({
    collection: 'users',
    depth: 0,
    where: {
      email: {
        equals: 'demo-author@example.com',
      },
    },
  })

  payload.logger.info(`— Seeding media...`)

  const [image1Buffer, image2Buffer, image3Buffer, hero1Buffer] = await Promise.all([
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post1.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post2.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-post3.webp',
    ),
    fetchFileByURL(
      'https://raw.githubusercontent.com/payloadcms/payload/refs/heads/main/templates/website/src/endpoints/seed/image-hero1.webp',
    ),
  ])

  await seedSocialSettings(payload)

  const [demoAuthor, image1Doc, image2Doc, image3Doc, imageHomeDoc] = await Promise.all([
    payload.create({
      collection: 'users',
      data: {
        name: 'Demo Author',
        email: 'demo-author@example.com',
        password: 'password',
      },
    }),
    payload.create({
      collection: 'media',
      data: image1,
      file: image1Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image2Buffer,
    }),
    payload.create({
      collection: 'media',
      data: image2,
      file: image3Buffer,
    }),
    payload.create({
      collection: 'media',
      data: imageHero1,
      file: hero1Buffer,
    }),
    categories.map((category) =>
      payload.create({
        collection: 'categories',
        data: {
          title: category,
          slug: category,
        },
      }),
    ),
  ])

  payload.logger.info(`— Seeding posts...`)

  // Do not create posts with `Promise.all` because we want the posts to be created in order
  // This way we can sort them by `createdAt` or `publishedAt` and they will be in the expected order
  const post1Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post1({ heroImage: image1Doc, blockImage: image2Doc, author: demoAuthor }),
  })

  const post2Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post2({ heroImage: image2Doc, blockImage: image3Doc, author: demoAuthor }),
  })

  const post3Doc = await payload.create({
    collection: 'posts',
    depth: 0,
    context: {
      disableRevalidate: true,
    },
    data: post3({ heroImage: image3Doc, blockImage: image1Doc, author: demoAuthor }),
  })

  // update each post with related posts
  await payload.update({
    id: post1Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post2Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post2Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post1Doc.id, post3Doc.id],
    },
  })
  await payload.update({
    id: post3Doc.id,
    collection: 'posts',
    data: {
      relatedPosts: [post1Doc.id, post2Doc.id],
    },
  })

  payload.logger.info(`— Seeding contact form...`)

  const contactForm = await payload.create({
    collection: 'forms',
    depth: 0,
    data: contactFormData,
  })

  payload.logger.info(`— Seeding pages...`)

  const [_, contactPage] = await Promise.all([
    payload.create({
      collection: 'pages',
      depth: 0,
      data: home({ heroImage: imageHomeDoc, metaImage: image2Doc }),
    }),
    payload.create({
      collection: 'pages',
      depth: 0,
      data: contactPageData({ contactForm: contactForm }),
    }),
  ])

  payload.logger.info(`— Seeding globals...`)

  await Promise.all([
    payload.updateGlobal({
      slug: 'header',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Posts',
              url: '/posts',
            },
          },
          {
            link: {
              type: 'reference',
              label: 'Contact',
              reference: {
                relationTo: 'pages',
                value: contactPage.id,
              },
            },
          },
        ],
      },
    }),
    payload.updateGlobal({
      slug: 'footer',
      data: {
        navItems: [
          {
            link: {
              type: 'custom',
              label: 'Admin',
              url: '/admin',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Source Code',
              newTab: true,
              url: 'https://github.com/payloadcms/payload/tree/main/templates/website',
            },
          },
          {
            link: {
              type: 'custom',
              label: 'Payload',
              newTab: true,
              url: 'https://payloadcms.com/',
            },
          },
        ],
      },
    }),
  ])

  payload.logger.info('Seeded database successfully!')
}

async function fetchFileByURL(url: string): Promise<File> {
  const res = await fetch(url, {
    credentials: 'include',
    method: 'GET',
  })

  if (!res.ok) {
    throw new Error(`Failed to fetch file from ${url}, status: ${res.status}`)
  }

  const data = await res.arrayBuffer()

  return {
    name: url.split('/').pop() || `file-${Date.now()}`,
    data: Buffer.from(data),
    mimetype: `image/${url.split('.').pop()}`,
    size: data.byteLength,
  }
}
