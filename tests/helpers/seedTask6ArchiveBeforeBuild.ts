import { getPayload, type RequiredDataFromCollectionSlug } from 'payload'

import config from '../../src/payload.config.js'
import { assertRunScopedE2EDatabaseURI } from './e2eDatabase'

const runID = process.env.PLAYWRIGHT_E2E_RUN_ID
const databaseURI = process.env.DATABASE_URI

if (!runID || !databaseURI) {
  throw new Error('PLAYWRIGHT_E2E_RUN_ID and DATABASE_URI are required for the Task 6 archive seed.')
}

if (process.env.DISABLE_R2_STORAGE !== 'true') {
  throw new Error('DISABLE_R2_STORAGE=true is required for the Task 6 archive seed.')
}

assertRunScopedE2EDatabaseURI(databaseURI, runID)

const postPrefix = `e2e-task6-matrix-archive-${runID}-post-`
const postSlugs = Array.from({ length: 13 }, (_, index) => {
  return `${postPrefix}${String(index + 1).padStart(2, '0')}`
})
const matrixPostPrefix = `e2e-task6-matrix-${runID}-post-`
const matrixPostSlugs = [
  `${matrixPostPrefix}banners`,
  ...Array.from(
    { length: 13 },
    (_, index) => `${matrixPostPrefix}${String(index + 1).padStart(2, '0')}`,
  ),
]
const disableRevalidate = { context: { disableRevalidate: true } }
const paragraph = (value: string) => ({
  children: [
    {
      detail: 0,
      format: 0,
      mode: 'normal',
      style: '',
      text: value,
      type: 'text',
      version: 1,
    },
  ],
  direction: 'ltr',
  format: '',
  indent: 0,
  textFormat: 0,
  textStyle: '',
  type: 'paragraph',
  version: 1,
})

function content(value: string): RequiredDataFromCollectionSlug<'posts'>['content'] {
  return {
    root: {
      children: [paragraph(value)],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  } as RequiredDataFromCollectionSlug<'posts'>['content']
}

console.log(
  `Task 6 prebuild archive target: ${databaseURI}, run ${runID}; exactly ${postSlugs.length} run-scoped Post slugs; R2 disabled.`,
)

const payload = await getPayload({ config })

try {
  await payload.delete({
    collection: 'posts',
    where: { slug: { in: [...postSlugs, ...matrixPostSlugs] } },
    overrideAccess: true,
    ...disableRevalidate,
  })

  for (const [index, slug] of postSlugs.entries()) {
    const suffix = String(index + 1).padStart(2, '0')
    const title = `E2E Task6 Archive Card ${suffix}`

    await payload.create({
      collection: 'posts',
      data: {
        _status: 'published',
        content: content(`${title} body copy for the static archive fixture.`),
        slug,
        title,
      },
      overrideAccess: true,
      ...disableRevalidate,
    })
  }

  const seededPosts = await payload.find({
    collection: 'posts',
    limit: 20,
    overrideAccess: true,
    where: { slug: { in: postSlugs } },
  })

  if (seededPosts.totalDocs !== 13) {
    throw new Error(`Expected 13 Task 6 archive posts, found ${seededPosts.totalDocs}.`)
  }

  console.log(
    `Task 6 prebuild archive seed: ${seededPosts.totalDocs} posts in ${databaseURI}, run ${runID}`,
  )
} finally {
  await payload.destroy()
}
