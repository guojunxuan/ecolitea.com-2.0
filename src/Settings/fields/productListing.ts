import type { CollapsibleField, UploadFieldSingleValidation } from 'payload'

import { validations } from 'payload'
import { imageOnly, imageOrVideo } from '@/collections/mediaUploadPolicy'
import { link } from '@/fields/link'

import { trimText } from './validation'
import { heroThemeDescription, heroThemeOptions } from './heroTheme'

export const validateCategoryCarouselItems: import('payload').ArrayFieldValidation = (
  value,
  options,
) => {
  const result = validations.array(value, options)
  if (result !== true || !Array.isArray(value)) return result
  const seen = new Set<string>()
  for (const item of value) {
    const category = (item as { category?: string | { id?: string } } | null)?.category
    const id = typeof category === 'object' && category ? category.id : category
    if (!id) continue
    if (seen.has(String(id))) return 'Each category can only appear once in the carousel.'
    seen.add(String(id))
  }
  return true
}

const validateDesktopMedia: UploadFieldSingleValidation = (value, options) =>
  validations.upload(value, {
    ...options,
    required: (options.siblingData as { showText?: boolean } | undefined)?.showText !== true,
  })

const whenCta = (_: unknown, siblingData: { enableCta?: boolean } | undefined) =>
  siblingData?.enableCta === true

export const productListingHero = (): CollapsibleField => ({
  type: 'collapsible',
  label: 'Hero',
  admin: {
    initCollapsed: false,
    style: { marginTop: 0, marginBottom: 'var(--spacer-2-5)' },
  },
  fields: [
    {
      name: 'heroSlides',
      label: 'Slides',
      type: 'array',
      maxRows: 8,
      admin: {
        components: { RowLabel: '@/Settings/components/HeroSlideRowLabel#HeroSlideRowLabel' },
        description:
          'Slides rotate every 4 seconds. Drag rows to reorder. Enable Show text to display the slide title and description.',
      },
      fields: [
        {
          name: 'showText',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description: 'Display the title and description on the website. Media is optional for text slides.',
          },
        },
        {
          name: 'title',
          label: 'Title',
          type: 'text',
          required: true,
          hooks: { beforeValidate: [trimText] },
          admin: {
            description: 'Slide title. Displayed when Show text is enabled.',
          },
        },
        {
          name: 'description',
          label: 'Description',
          type: 'textarea',
          hooks: { beforeValidate: [trimText] },
          admin: { description: 'Optional slide description. Displayed when Show text is enabled.' },
        },
        {
          name: 'media',
          label: 'Desktop media',
          type: 'upload',
          relationTo: 'media',
          validate: validateDesktopMedia,
          filterOptions: imageOrVideo,
          admin: {
            description:
              'Image or MP4 video for desktop and the fallback for mobile. Required unless Show text is enabled. Use 16:9; the Hero crops to fill its frame. Images use their focal point; videos are centered.',
          },
        },
        {
          name: 'mobileMedia',
          label: 'Mobile media',
          type: 'upload',
          relationTo: 'media',
          filterOptions: imageOrVideo,
          admin: {
            description:
              'Optional image or MP4 for screens below 48rem. Use 4:5. When empty, the desktop media is cropped using the image focal point (videos are centered).',
          },
        },
        {
          name: 'theme',
          label: 'Header Theme',
          type: 'select',
          required: true,
          defaultValue: 'dark',
          options: heroThemeOptions,
          admin: {
            description: `${heroThemeDescription} Follows this slide while it is active.`,
          },
        },
        {
          name: 'enableCta',
          label: 'Enable CTA link',
          type: 'checkbox',
          defaultValue: false,
          admin: {
            description:
              'Enable to make the whole slide image or video clickable using the CTA link below.',
          },
        },
        link({
          appearances: false,
          relationTo: ['pages', 'blogs', 'products', 'product-categories'],
          labelOverrides: {
            label: 'Accessible link label',
            hooks: { beforeValidate: [trimText] },
            admin: {
              description:
                'Describes the destination for screen readers. Not displayed over the media.',
            },
          },
          overrides: {
            name: 'cta',
            label: 'CTA',
            admin: {
              condition: whenCta,
              description:
                'Choose the destination opened when the slide image or video is clicked. The link label is for screen readers; no button is displayed over the media.',
            },
          },
        }),
      ],
    },
  ],
})

export const productCategoryCarousel = (): CollapsibleField => ({
  type: 'collapsible',
  label: 'Category Carousel',
  admin: {
    initCollapsed: false,
    style: { marginTop: 0, marginBottom: 'var(--spacer-2-5)' },
  },
  fields: [
    {
      name: 'categoryCarousel',
      label: false,
      type: 'group',
      admin: {
        hideGutter: true,
        description: 'Only categories with public products appear on the site.',
      },
      fields: [
        { name: 'enabled', type: 'checkbox', defaultValue: true },
        {
          name: 'carouselStatus',
          type: 'ui',
          admin: {
            components: {
              Field: '@/Settings/components/ListingCarouselNotice#CategoryCarouselStatus',
            },
          },
        },
        {
          name: 'items',
          type: 'array',
          validate: validateCategoryCarouselItems,
          admin: {
            components: {
              RowLabel: '@/Settings/components/CategoryCarouselRowLabel#CategoryCarouselRowLabel',
            },
            description:
              'Only categories with public products appear on the site. Drag to reorder. Leave empty for all public categories. The previous category selection must be selected again in this list.',
          },
          fields: [
            {
              name: 'category',
              type: 'relationship',
              relationTo: 'product-categories',
              required: true,
              admin: {
                description:
                  'Opens the category page when the carousel card is clicked. Each category can only appear once.',
              },
            },
            {
              name: 'image',
              type: 'upload',
              relationTo: 'media',
              filterOptions: imageOnly,
              admin: {
                description:
                  'Optional carousel-only image. Transparent product cut-outs work best. Select an image to choose its fit. When empty, the category image is used with Cover; the saved fit is retained.',
              },
            },
            {
              name: 'imageFit',
              type: 'select',
              defaultValue: 'cover',
              options: [
                { label: 'Contain', value: 'contain' },
                { label: 'Cover', value: 'cover' },
              ],
              admin: {
                condition: (_, siblingData) => Boolean(siblingData?.image),
                description:
                  'Applies only to the override image. Use Contain for transparent product cut-outs. Cover fills the frame using the image focal point. Removing the image hides this control and keeps the saved fit.',
              },
            },
          ],
        },
      ],
    },
  ],
})
