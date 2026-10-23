import { describe, expect, it } from 'vitest'
import { ValidationError } from 'payload'
import { Products } from '@/collections/Products'
import { imageOnly } from '@/collections/mediaUploadPolicy'
import type { ArrayField, TextField, UploadField } from 'payload'
const tabs = Products.fields.find((field) => field.type === 'tabs')!
if (tabs.type !== 'tabs') throw new Error('Missing tabs')
const field = tabs.tabs.find((tab) => tab.label === 'Options')?.fields[0] as ArrayField
const validate = (value: unknown, previousValue?: unknown) =>
  field?.validate?.(value as never, { data: {}, previousValue, path: ['options'] } as never)
const text = (name = 'Color', label = 'Red') => ({ name, display: 'text', values: [{ label }] })
function expectPath(value: unknown, path: string, previousValue?: unknown) {
  try {
    validate(value, previousValue)
    expect.fail('Expected field validation error')
  } catch (error) {
    expect(error).toBeInstanceOf(ValidationError)
    expect((error as ValidationError).data?.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })]),
    )
  }
}
describe('product options schema and server validation', () => {
  it('uses native constraints, collapsed rows and exact explanatory copy', () => {
    expect(field).toMatchObject({
      name: 'options',
      type: 'array',
      admin: {
        initCollapsed: true,
        description:
          'Options are generic: name each group freely (Color, Size, Capacity, Finish…). Selecting a value can swap the gallery and override specifications. No SKU or stock.',
      },
    })
    expect(field.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'name', required: true, maxLength: 40 }),
        expect.objectContaining({
          name: 'display',
          required: true,
          defaultValue: 'text',
          options: ['text', 'swatch', 'image'],
        }),
      ]),
    )
    const values = field.fields.find((f) => 'name' in f && f.name === 'values') as ArrayField
    expect(values).toMatchObject({ required: true, minRows: 1, admin: { initCollapsed: true } })
    expect(values.fields.find((f) => 'name' in f && f.name === 'label')).toMatchObject({
      required: true,
      maxLength: 40,
    })
    for (const name of ['thumbnail', 'gallery'])
      expect(values.fields.find((f) => 'name' in f && f.name === name)).toMatchObject({
        type: 'upload',
        filterOptions: imageOnly,
      })
  })
  it.each([' Color ', 'COLOR', 'CoLoR'])(
    'rejects duplicate names %s at the repeated field',
    (name) => expectPath([text(), text(name)], 'options.1.name'),
  )
  it('rejects same-scope key collisions and empty keys for groups and values', () => {
    expectPath([text('Tea Bag'), text('Tea-Bag')], 'options.1.name')
    expectPath([text('!!!')], 'options.0.name')
    expectPath(
      [{ ...text(), values: [{ label: 'Tea Bag' }, { label: 'Tea-Bag' }] }],
      'options.0.values.1.label',
    )
    expectPath(
      [{ ...text(), values: [{ label: ' Red ' }, { label: 'RED' }] }],
      'options.0.values.1.label',
    )
    expectPath([text('Color', '!!!')], 'options.0.values.0.label')
  })
  it('validates active display without clearing hidden data', () => {
    expect(validate(null, [{ name: '!!!' }])).toBe(true)
    expect(
      validate([{ ...text(), values: [{ label: 'Red', swatch: 'bad', thumbnail: null }] }]),
    ).toBe(true)
    for (const swatch of [null, '', '#12', '#12345g'])
      expectPath(
        [{ ...text(), display: 'swatch', values: [{ label: 'Red', swatch }] }],
        'options.0.values.0.swatch',
      )
    for (const swatch of ['#abc', '#aBC123'])
      expect(validate([{ ...text(), display: 'swatch', values: [{ label: 'Red', swatch }] }])).toBe(
        true,
      )
    expectPath([{ ...text(), display: 'image' }], 'options.0.values.0.thumbnail')
    const previous = [
      {
        id: 'group',
        ...text(),
        display: 'image',
        values: [{ id: 'value', label: 'Red', thumbnail: 'id' }],
      },
    ]
    expect(validate([{ id: 'group', values: [{ id: 'value', label: 'Red' }] }], previous)).toBe(
      true,
    )
    expectPath(
      [{ id: 'group', values: [{ id: 'value', thumbnail: null }] }],
      'options.0.values.0.thumbnail',
      previous,
    )
  })
  it('locates parent display for conditions in the second group through public path', () => {
    const values = field.fields.find((f) => 'name' in f && f.name === 'values') as ArrayField
    const data = { options: [{ display: 'swatch' }, { display: 'image' }] }
    for (const name of ['swatch', 'thumbnail']) {
      const f = values.fields.find((f) => 'name' in f && f.name === name) as TextField | UploadField
      expect(
        f.admin?.condition?.(data, { label: 'Value' }, {
          path: ['options', 1, 'values', 0, name],
        } as never),
      ).toBe(name === 'thumbnail')
    }
  })
})
