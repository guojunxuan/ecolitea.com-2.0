import type { CollapsibleField } from 'payload'
import { validateSvgSiteAsset } from '@/collections/SiteAssets'
import { validateArticleSharePlatforms } from './validation'

export const articleShareField: CollapsibleField = {
  type: 'collapsible',
  label: 'Article Sharing',
  admin: { initCollapsed: true, style: { marginTop: 0, marginBottom: 0 } },
  fields: [
    {
      name: 'share',
      type: 'group',
      label: false,
      admin: { hideGutter: true },
      fields: [
        {
          name: 'platforms',
          type: 'array',
          defaultValue: [],
          validate: validateArticleSharePlatforms,
          fields: [
            { name: 'name', type: 'text', required: true },
            {
              name: 'icon',
              type: 'upload',
              relationTo: 'site-assets',
              required: true,
              filterOptions: { mimeType: { equals: 'image/svg+xml' } },
              validate: validateSvgSiteAsset,
            },
            {
              name: 'shareURL',
              label: 'Share URL',
              type: 'text',
              required: true,
              admin: {
                description:
                  'Use {url} for the article address and {title} for its title. Adjust the starter URL for the platform.',
                components: {
                  Field: '@/Settings/components/ArticleShareURLField#ArticleShareURLField',
                },
              },
            },
          ],
        },
        { name: 'copyLink', type: 'checkbox', defaultValue: true },
      ],
    },
  ],
}
