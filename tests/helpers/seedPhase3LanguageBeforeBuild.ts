import { getPayload } from 'payload'
import config from '../../src/payload.config.js'
import { extract } from '../../src/plugins/translation/extract'
import { getTranslationRule } from '../../src/plugins/translation/rules'
import { fixtureContext, richText, reportBlogEnvironment } from './blogFixtures'
import { assertPhase3I18nFixtureEnvironment } from './phase3I18nFixture'

if (!assertPhase3I18nFixtureEnvironment(process.env))
  throw new Error('Phase3 fixture mode is required.')
reportBlogEnvironment(process.env.PLAYWRIGHT_E2E_RUN_ID!)
console.info(
  `Phase3 language fixture target=${new URL(process.env.DATABASE_URI!).pathname}; storage=disabled; provider=none`,
)
const payload = await getPayload({ config })
try {
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
