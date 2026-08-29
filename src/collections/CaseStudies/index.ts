import type { CollectionConfig } from 'payload'
import { authenticated } from '../../access/authenticated'
import { authenticatedOrPublished } from '../../access/authenticatedOrPublished'
import { hero } from '@/heros/config'
import { CallToAction } from '../../blocks/CallToAction/config'
import { Content } from '../../blocks/Content/config'
import { MediaBlock } from '../../blocks/MediaBlock/config'
import { generatePreviewPath } from '../../utilities/generatePreviewPath'
import { revalidateCaseStudy, revalidateDelete } from './hooks/revalidateCaseStudy'
import { MetaDescriptionField, MetaImageField, MetaTitleField, OverviewField, PreviewField } from '@payloadcms/plugin-seo/fields'

export const CaseStudies: CollectionConfig = {
  slug: 'case-studies',
  access: { create: authenticated, delete: authenticated, read: authenticatedOrPublished, update: authenticated },
  admin: { useAsTitle: 'title', livePreview: { url: ({ data, req }) => generatePreviewPath({ slug: data?.slug, collection: 'case-studies', req }) }, preview: (data, { req }) => generatePreviewPath({ slug: data?.slug as string, collection: 'case-studies', req }) },
  fields: [
    { name: 'title', type: 'text', required: true },
    { type: 'tabs', tabs: [{ fields: [hero], label: 'Hero' }, { fields: [{ name: 'layout', type: 'blocks', blocks: [CallToAction, Content, MediaBlock], required: true }], label: 'Content' }, { name: 'meta', label: 'SEO', fields: [OverviewField({ titlePath: 'meta.title', descriptionPath: 'meta.description', imagePath: 'meta.image' }), MetaTitleField({ hasGenerateFn: true }), MetaImageField({ relationTo: 'media' }), MetaDescriptionField({}), PreviewField({ hasGenerateFn: true, titlePath: 'meta.title', descriptionPath: 'meta.description' })] }] },
    { name: 'publishedAt', type: 'date' },
    { name: 'slug', type: 'slug', useAsSlug: 'title', required: true },
  ],
  hooks: { afterChange: [revalidateCaseStudy], afterDelete: [revalidateDelete] },
  versions: { drafts: { autosave: { interval: 100 }, schedulePublish: true }, maxPerDoc: 50 },
}
