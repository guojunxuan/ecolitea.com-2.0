import { describe, expect, it, vi } from 'vitest'
import { fieldSchemasToFormState } from '@payloadcms/ui/forms/fieldSchemasToFormState'
import { ValidationError } from 'payload'
import { Products } from '@/collections/Products'
import type { ArrayField } from 'payload'
const tabs = Products.fields.find((field) => field.type === 'tabs')
if (tabs?.type !== 'tabs') throw new Error('Missing tabs')
const sections = tabs.tabs.find((tab) => tab.label === 'Details')?.fields[0] as ArrayField
const sectionValidation = (
  value: unknown,
  previousValue?: unknown,
  event?: 'onChange' | 'submit',
) =>
  sections.validate?.(
    value as never,
    {
      data: { sections: value },
      previousValue,
      event,
      maxRows: 8,
      req: { t: (key: string) => key },
    } as never,
  )
const normalizeSections = async (data: unknown, originalDoc?: unknown) => {
  let result = data
  for (const hook of Products.hooks?.beforeValidate ?? [])
    result = await hook({ data: result, originalDoc } as never)
  return result as { sections: { label?: string; anchor?: string; blocks?: unknown[] }[] }
}
describe('anchored product sections', () => {
  it('generates only empty anchors from effective row data and preserves hidden or legacy content', async () => {
    const data = {
      sections: [
        { label: '  Tea & Materials 中文  ', anchor: '', blocks: [] },
        { label: 'Custom', anchor: 'chosen-anchor' },
      ],
      layout: [{ old: true }],
    }
    expect(await normalizeSections(data)).toEqual({
      ...data,
      sections: [
        { label: '  Tea & Materials 中文  ', anchor: 'tea-materials', blocks: [] },
        { label: 'Custom', anchor: 'chosen-anchor' },
      ],
    })
    const old = { sections: [{ id: 'row', label: 'Old', anchor: 'chosen-anchor' }] }
    expect(
      (await normalizeSections({ sections: [{ id: 'row', label: 'Renamed' }] }, old)).sections[0]
        .anchor,
    ).toBe('chosen-anchor')
    expect(
      (await normalizeSections({ sections: [{ id: 'row', anchor: '' }] }, old)).sections[0].anchor,
    ).toBe('old')
    expect(await normalizeSections({ title: 'Partial' }, old)).toEqual({ title: 'Partial' })
  })
  it.each([
    'overview',
    'product-tab-specifications',
    'product-tab-overview',
    'related-products',
    '9-start',
    'Upper',
    'bad space',
  ])('rejects invalid/reserved anchor %s with a child field path', (anchor) => {
    try {
      sectionValidation([{ label: 'Section', anchor }])
      expect.fail('Expected field error')
    } catch (error) {
      expect(error).toBeInstanceOf(ValidationError)
      expect((error as ValidationError).data?.errors).toContainEqual(
        expect.objectContaining({ path: 'sections.0.anchor' }),
      )
    }
  })
  it('assigns unique ordinal fallbacks to labels without Latin slugs', async () => {
    const data = {
      sections: [{ label: '规格' }, { label: '其他' }, { label: 'Manual', anchor: 'section-1' }],
    }
    expect(sectionValidation(data.sections, undefined, 'onChange')).toBe(true)
    const normalized = await normalizeSections(data)
    expect(normalized.sections.map((row) => row.anchor)).toEqual([
      'section-1-2',
      'section-2',
      'section-1',
    ])
    expect(sectionValidation(normalized.sections)).toBe(true)
    expect(
      sectionValidation([
        { label: 'Legacy', anchor: 'options' },
        { label: 'Specs', anchor: 'specifications' },
      ]),
    ).toBe(true)
  })
  it('rejects duplicate generated anchors without renaming them', async () => {
    const data = await normalizeSections({ sections: [{ label: 'Same' }, { label: 'Same' }] })
    expect(data.sections.map((row) => row.anchor)).toEqual(['same', 'same'])
    expect(() => sectionValidation(data.sections)).toThrow(ValidationError)
  })
  it('accepts empty sections and keeps the native eight-row constraint', () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      label: 'Section',
      anchor: `section-${i}`,
      blocks: [],
    }))
    expect(sectionValidation(rows)).toBe(true)
    expect(sectionValidation([...rows, { label: 'Ninth', anchor: 'ninth' }])).toBe(
      'validation:requiresNoMoreThan',
    )
    expect(sectionValidation(null)).toBe(true)
  })
  it('handles numeric Admin previousValue and returns onChange feedback', async () => {
    const logger = { error: vi.fn() }
    const result = await fieldSchemasToFormState({
      collectionSlug: 'products',
      fields: [sections],
      fieldSchemaMap: undefined,
      data: { sections: [{ id: 'row', label: 'Reserved', anchor: 'overview', blocks: [] }] },
      permissions: {},
      preferences: { fields: {} },
      previousFormState: { sections: { initialValue: 1, value: 1 } },
      renderAllFields: false,
      operation: 'update',
      schemaPath: 'products',
      req: {
        t: (key: string) => key,
        payload: { logger, config: { localization: false } },
      } as never,
    })
    expect(result.sections.valid).toBe(false)
    expect(result.sections.errorMessage).toContain('sections.0.anchor')
    expect(logger.error).not.toHaveBeenCalled()
  })
})
