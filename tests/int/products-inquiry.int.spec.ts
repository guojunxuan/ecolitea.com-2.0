import type { CMSLinkType } from '@/components/Link'
import type { InquiryButton } from '@/utilities/products/models'
import { describe, expect, it, vi } from 'vitest'
import { fieldSchemasToFormState } from '@payloadcms/ui/forms/fieldSchemasToFormState'
import type { ArrayField, GroupField } from 'payload'
import { ValidationError } from 'payload'
import { Products } from '@/collections/Products'
import { productTab } from '@/Settings/fields/product'

const modules = import.meta.glob('/src/utilities/products/inquiry.ts', { eager: true }) as Record<
  string,
  { resolveProductInquiry: (product: unknown, settings?: unknown) => unknown }
>
const resolve = (product: unknown, settings?: unknown) => {
  const fn = modules['/src/utilities/products/inquiry.ts']?.resolveProductInquiry
  expect(fn).toBeTypeOf('function')
  return fn(product, settings)
}
// Inquiry output can be spread directly into the existing CMSLink component.
const cmsLink = (button: InquiryButton): CMSLinkType => button
void cmsLink

const custom = {
  type: 'custom',
  url: '/contact',
  label: 'Contact',
  newTab: true,
  appearance: 'outline',
}
const reference = {
  type: 'reference',
  reference: { relationTo: 'pages', value: { id: 'page', slug: 'contact' } },
  label: 'Ask',
  newTab: false,
  appearance: 'default',
}
const settings = { product: { inquiry: { buttons: [{ id: 'row', link: reference }] } } }
const inquiryField = () => {
  const tabs = Products.fields.find((field) => field.type === 'tabs')!
  return tabs.tabs[0].fields.find(
    (field) => 'name' in field && field.name === 'inquiry',
  ) as GroupField
}

describe('product inquiry resolution', () => {
  it.each(['default', undefined, null])(
    'resolves %s through Settings and keeps populated CMSLink references',
    (mode) => {
      const product = { inquiry: { mode, buttons: [{ link: custom }] } }
      const before = structuredClone({ product, settings })
      expect(resolve(product, settings)).toEqual({ buttons: [reference] })
      expect({ product, settings }).toEqual(before)
    },
  )
  it('uses custom links and ignores default buttons for hidden mode', () => {
    expect(resolve({ inquiry: { mode: 'custom', buttons: [{ link: custom }] } }, settings)).toEqual(
      { buttons: [custom] },
    )
    expect(resolve({ inquiry: { mode: 'hidden', buttons: [{ link: custom }] } }, settings)).toEqual(
      { buttons: [] },
    )
  })
  it.each([undefined, null, {}, { product: {} }, { product: { inquiry: { buttons: null } } }])(
    'has no invented defaults for missing Settings %s',
    (value) => {
      expect(resolve({}, value)).toEqual({ buttons: [] })
    },
  )
  it('normalizes incomplete custom drafts to empty buttons', () => {
    expect(resolve({ inquiry: { mode: 'custom' } }, settings)).toEqual({ buttons: [] })
  })
})

describe('inquiry schema and conditional server validation', () => {
  it('uses the shared link fields, two native rows and custom-only visibility', () => {
    expect(inquiryField()).toMatchObject({
      type: 'group',
      fields: expect.arrayContaining([
        expect.objectContaining({
          name: 'mode',
          type: 'radio',
          defaultValue: 'default',
          options: ['default', 'custom', 'hidden'],
        }),
      ]),
    })
    const buttons = inquiryField().fields.find(
      (field) => 'name' in field && field.name === 'buttons',
    ) as ArrayField
    expect(buttons).toMatchObject({
      type: 'array',
      maxRows: 2,
      admin: {
        components: {
          RowLabel: '@/collections/Products/admin/InquiryButtonRowLabel#InquiryButtonRowLabel',
        },
      },
    })
    expect(buttons.minRows).toBeUndefined()
    for (const mode of ['default', 'custom', 'hidden'])
      expect(buttons.admin?.condition?.({}, { mode }, {} as never)).toBe(mode === 'custom')
    const link = buttons.fields.find(
      (field) => 'name' in field && field.name === 'link',
    ) as GroupField
    expect(link.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'appearance',
          options: [
            { label: 'Default', value: 'default' },
            { label: 'Outline', value: 'outline' },
          ],
        }),
      ]),
    )
    const row = link.fields.find(
      (field) =>
        field.type === 'row' &&
        field.fields.some((item) => 'name' in item && item.name === 'reference'),
    )!
    expect(row).toMatchObject({
      fields: expect.arrayContaining([
        expect.objectContaining({ name: 'reference', relationTo: ['pages', 'posts'] }),
      ]),
    })
  })
  it('places Settings Inquiry beside Listing SEO with one to two button rows', () => {
    const group = productTab.fields.find(
      (field) => 'name' in field && field.name === 'inquiry',
    ) as GroupField
    expect(group).toMatchObject({
      label: 'Inquiry',
      type: 'group',
      admin: { description: 'Default inquiry buttons for products set to Default.' },
      fields: expect.arrayContaining([
        expect.objectContaining({ name: 'buttons', type: 'array', minRows: 1, maxRows: 2 }),
      ]),
    })
  })
  it('validates the custom minimum with exact paths, keeps inactive data and native maxRows', () => {
    const buttons = inquiryField()?.fields.find(
      (field) => 'name' in field && field.name === 'buttons',
    ) as ArrayField
    expect(buttons?.validate).toBeTypeOf('function')
    const validate = (value: unknown, mode: string, event = 'submit', previousValue: unknown = 0) =>
      buttons.validate!(
        value as never,
        {
          siblingData: { mode, buttons: value },
          data: { inquiry: { mode, buttons: value } },
          event,
          previousValue,
          maxRows: 2,
          req: { t: (key: string) => key },
          path: ['inquiry', 'buttons'],
        } as never,
      )
    for (const mode of ['default', 'hidden']) expect(validate([], mode)).toBe(true)
    expect(validate([{ link: custom }], 'custom')).toBe(true)
    expect(validate([], 'custom', 'onChange', 1)).toContain('inquiry.buttons')
    try {
      validate([], 'custom')
      expect.fail('Expected validation error')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).data?.errors).toContainEqual(
        expect.objectContaining({ path: 'inquiry.buttons' }),
      )
    }
    expect(validate(Array(3).fill({ link: custom }), 'custom')).toBe(
      'validation:requiresNoMoreThan',
    )
  })
})

it.each([{ buttons: [] }, { buttons: [{ id: 'row', link: custom }] }])(
  'validates actual Admin onChange rows with numeric previousValue',
  async ({ buttons }) => {
    const logger = { error: vi.fn() }
    const result = await fieldSchemasToFormState({
      collectionSlug: 'products',
      fields: [inquiryField()],
      fieldSchemaMap: undefined,
      data: { inquiry: { mode: 'custom', buttons } },
      permissions: {},
      preferences: { fields: {} },
      previousFormState: { 'inquiry.buttons': { initialValue: 1, value: 1 } },
      renderAllFields: false,
      operation: 'update',
      schemaPath: 'products',
      req: {
        t: (key: string) => key,
        payload: { logger, config: { localization: false } },
      } as never,
    })
    if (!buttons.length) {
      expect(result['inquiry.buttons'].valid).toBe(false)
      expect(result['inquiry.buttons'].errorMessage).toContain('inquiry.buttons: Add at least one')
    } else expect(result['inquiry.buttons'].valid).not.toBe(false)
    expect(logger.error).not.toHaveBeenCalled()
  },
)
