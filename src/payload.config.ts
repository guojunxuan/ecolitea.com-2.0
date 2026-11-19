import { mongooseAdapter } from '@payloadcms/db-mongodb'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Blogs } from './collections/Blogs'
import { BlogCategories } from './collections/BlogCategories'
import { ProductCategories } from './collections/ProductCategories'
import { Products } from './collections/Products'
import { Categories } from './collections/Categories'
import { SiteAssets } from './collections/SiteAssets'
import { CaseStudies } from './collections/CaseStudies'
import { Media } from './collections/Media'
import { Documents } from './collections/Documents'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { SocialPlatforms } from './collections/SocialPlatforms'
import { QuoteRequests } from './collections/QuoteRequests'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { SiteSettings } from './SiteSettings/config'
import { Settings } from './Settings/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { serverEnv } from './utilities/env'
import { createEmailAdapter } from './plugins/email/adapter'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  serverURL: getServerSideURL(),
  email: createEmailAdapter(),
  admin: {
    theme: 'all',
    meta: {
      titleSuffix: ' · Admin',
      defaultOGImageType: 'off',
      icons: {
        icon: [
          { url: '/favicon.ico', sizes: '32x32' },
          { url: '/favicon.svg', type: 'image/svg+xml' },
        ],
      },
    },
    components: {
      graphics: {
        Logo: '@/components/admin/brand/AdminLogo#AdminLogo',
        Icon: '@/components/admin/brand/AdminIcon#AdminIcon',
      },
    },
    importMap: {
      baseDir: path.resolve(dirname),
    },
    user: Users.slug,
    livePreview: {
      breakpoints: [
        {
          label: 'Mobile',
          name: 'mobile',
          width: 375,
          height: 667,
        },
        {
          label: 'Tablet',
          name: 'tablet',
          width: 768,
          height: 1024,
        },
        {
          label: 'Desktop',
          name: 'desktop',
          width: 1440,
          height: 900,
        },
      ],
    },
  },
  // This config helps us configure global or default features that the other editors can inherit
  editor: defaultLexical,
  db: mongooseAdapter({
    url: serverEnv.DATABASE_URI,
    afterCreateConnection: (adapter) => {
      // Payload sets this flag before initializing CLI migrations, after loading this config.
      // Prevent Mongoose from creating the rename destination before migration preflight.
      if (process.env.PAYLOAD_MIGRATING === 'true') {
        adapter.collectionsSchemaOptions ??= {}
        adapter.collectionsSchemaOptions['site-assets'] = { autoCreate: false, autoIndex: false }
      }
    },
  }),
  collections: [
    Products,
    ProductCategories,
    QuoteRequests,
    Pages,
    Posts,
    Blogs,
    BlogCategories,
    CaseStudies,
    Categories,
    Media,
    Documents,
    SiteAssets,
    {
      slug: 'folders',
      folders: true,
      admin: {
        group: 'Assets',
        useAsTitle: 'name',
      },
      fields: [
        {
          name: 'name',
          type: 'text',
          required: true,
          label: 'Folder Name',
        },
      ],
    },
    Users,
    SocialPlatforms,
  ],
  cors: [getServerSideURL()].filter(Boolean),
  globals: [Header, Footer, SiteSettings, Settings],
  plugins,
  secret: serverEnv.PAYLOAD_SECRET,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, 'payload-types.ts'),
  },
  jobs: {
    // One designated Node process; all queues also includes native schedulePublish.
    autoRun: serverEnv.JOBS_AUTORUN ? [{ cron: '*/5 * * * * *', allQueues: true, limit: 1 }] : [],
    access: {
      run: ({ req }: { req: PayloadRequest }): boolean => {
        // Allow logged in users to execute this endpoint (default)
        if (req.user) return true

        const secret = process.env.CRON_SECRET
        if (!secret) return false

        // If there is no logged in user, then check
        // for the Vercel Cron secret to be present as an
        // Authorization header:
        const authHeader = req.headers.get('authorization')
        return authHeader === `Bearer ${secret}`
      },
    },
    tasks: [],
  },
})
