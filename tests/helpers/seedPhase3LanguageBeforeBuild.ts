import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { extract } from '../../src/plugins/translation/extract'
import { getTranslationRule } from '../../src/plugins/translation/rules'
import { fixtureContext, richText, reportBlogEnvironment } from './blogFixtures'
reportBlogEnvironment(process.env.PLAYWRIGHT_E2E_RUN_ID!)
console.info(
  `Phase3 language fixture target=${new URL(process.env.DATABASE_URI!).pathname}; storage=disabled; provider=none`,
)
const payload = await getPayload({ config })
try {
  const data = Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 30"><path d="M0 0h160v30H0z"/></svg>',
  )
  const logo = await payload.create({
    collection: 'site-assets',
    data: { alt: 'Phase4 test logo' },
    file: { data, mimetype: 'image/svg+xml', name: 'phase4-logo.svg', size: data.length },
    ...fixtureContext,
  })
  await payload.create({
    collection: 'users',
    data: {
      email: 'phase4-admin@example.invalid',
      password: 'phase4-test-only',
      name: 'Phase4 editor',
    },
    ...fixtureContext,
  })
  await payload.updateGlobal({
    slug: 'site-settings',
    data: {
      siteName: 'Phase4 Test',
      legalCompanyName: 'Phase4 Test Company',
      tagline: 'Test site',
      siteDescription: 'Isolated Phase4 fixture',
      logo: logo.id,
      salesEmail: 'phase4@example.invalid',
      phone: '+1 555 0100',
      address: 'Test address',
      languages: [
        { code: 'de', status: 'live' },
        { code: 'fr', status: 'translating' },
      ],
      regions: [
        { id: 'GLOBAL', label: 'Global', locale: 'en' },
        { id: 'DE', label: 'Deutschland', group: 'Europe', locale: 'de' },
        { id: 'AT', label: 'Österreich', group: 'Europe', locale: 'de' },
        { id: 'FR', label: 'France', group: 'Europe', locale: 'fr' },
      ],
    },
    ...fixtureContext,
  })
  for (const [slug, title, ready] of [
    ['home', 'Phase3 home', true],
    ['phase3-ready', 'Phase3 ready', true],
    ['phase3-english-only', 'Phase3 English only', false],
  ] as const) {
    const text = richText('Phase3 fixture content.', title)
    const page = await payload.create({
      collection: 'pages',
      data: {
        title,
        slug,
        hero: { type: 'lowImpact', headerTheme: 'light', richText: text },
        layout: [{ blockType: 'pageContent', columns: [] }],
        _status: 'published',
      },
      ...fixtureContext,
    })
    if (ready) {
      await payload.create({
        collection: 'translations',
        data: {
          sourceCollection: 'pages',
          sourceId: String(page.id),
          locale: 'de',
          status: 'ready',
          lastReadySourceVersion: 'phase3-fixture',
          fields: Object.fromEntries(
            extract(page, getTranslationRule('pages')!).map(({ path, source }) => [
              path,
              source.replace('Phase3', 'Deutsch'),
            ]),
          ),
        },
        ...fixtureContext,
      })
    }
  }
} finally {
  await payload.destroy()
}
