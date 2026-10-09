import { mongooseAdapter } from '@payloadcms/db-mongodb'
import sharp from 'sharp'
import path from 'path'
import { buildConfig, PayloadRequest } from 'payload'
import { fileURLToPath } from 'url'

import { Archive } from './blocks/ArchiveBlock/config'
import { Content } from './blocks/Content/config'
import { FormBlock } from './blocks/Form/config'
import { Code } from './blocks/Code/config'
import { Prose } from './blocks/Prose/config'
import { MediaBlock } from './blocks/MediaBlock/config'
import { KeyTakeaways } from './blocks/KeyTakeaways/config'
import { CallToAction } from './blocks/CallToAction/config'
import { Banner } from './blocks/Banner/config'

import { Blogs } from './collections/Blogs'
import { BlogCategories } from './collections/BlogCategories'
import { Categories } from './collections/Categories'
import { BrandAssets } from './collections/BrandAssets'
import { CaseStudies } from './collections/CaseStudies'
import { Media } from './collections/Media'
import { Pages } from './collections/Pages'
import { Posts } from './collections/Posts'
import { SocialPlatforms } from './collections/SocialPlatforms'
import { Users } from './collections/Users'
import { Footer } from './Footer/config'
import { Header } from './Header/config'
import { SiteSettings } from './SiteSettings/config'
import { Settings } from './Settings/config'
import { plugins } from './plugins'
import { defaultLexical } from '@/fields/defaultLexical'
import { getServerSideURL } from './utilities/getURL'
import { serverEnv } from './utilities/env'

const filename = fileURLToPath(import.meta.url)
const dirname = path.dirname(filename)

export default buildConfig({
  blocks: [Archive, Content, FormBlock, Code, Prose, MediaBlock, KeyTakeaways, CallToAction, Banner],
  admin: {
    components: {
      // The `BeforeLogin` component renders a message that you see while logging into your admin panel.
      // Feel free to delete this at any time. Simply remove the line below.
      beforeLogin: ['@/components/BeforeLogin'],
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
  }),
  collections: [
    {
      slug: 'folders',
      folders: true,
      admin: {
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
    Pages,
    Posts,
    Blogs,
    BlogCategories,
    Media,
    BrandAssets,
    SocialPlatforms,
    Categories,
    CaseStudies,
    Users,
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
