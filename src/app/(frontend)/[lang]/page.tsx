import PageTemplate, { generateMetadata } from './[slug]/page'
import { getPayload } from 'payload'
import config from '@payload-config'
import { readySourceIDs } from '@/utilities/i18n/seo'

export default PageTemplate
export { generateMetadata }

export async function generateStaticParams(options: { params: { lang: string } }) {
  const locale = options?.params.lang ?? 'en'
  if (locale === 'en') return [{}]
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'pages',
    draft: false,
    overrideAccess: false,
    depth: 0,
    limit: 1,
    where: { slug: { equals: 'home' } },
    select: {},
  })
  const id = result.docs[0]?.id
  return id && (await readySourceIDs(payload, 'pages', [String(id)], locale)).has(String(id))
    ? [{}]
    : []
}
