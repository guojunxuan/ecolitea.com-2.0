import { describe, expect, it } from 'vitest'
import { validateTitle } from '@/collections/Documents/validateTitle'

const run = async (title: unknown, extra = {}) =>
  validateTitle({ data: { title }, operation: 'create', req: {}, ...extra } as never)
const invoke = async (args: Parameters<typeof validateTitle>[0]) => validateTitle(args)
const error = (message: string) => ({ data: { errors: [{ path: 'title', message }] } })

describe('Document title integrity', () => {
  it.each([undefined, null, '', '  '])('requires title: %s', async (title) => {
    await expect(run(title)).rejects.toMatchObject(error('Title is required.'))
  })
  it.each(['ab', 'a'.repeat(151)])('bounds title length', async (title) => {
    await expect(run(title)).rejects.toMatchObject(error('Use 3–150 characters.'))
  })
  it.each([
    'scan_001',
    'Scan 2026-08-06',
    'document1',
    'Untitled',
    'New Document',
    '123',
    '2026-08-06',
    'tea.pdf',
    'Report.DOCX',
    'file.xlsx',
    'Tea.pptx',
  ])('rejects filenames/defaults: %s', async (title) => {
    const message =
      title.toLowerCase() === 'untitled'
        ? 'Title is too generic. Describe the document.'
        : 'Describe the document instead of using the file name.'
    await expect(run(title)).rejects.toMatchObject(error(message))
  })
  it.each(['document', 'file', 'pdf', 'doc', 'untitled', ' DOC '])(
    'generic wording takes priority: %s',
    async (title) => {
      await expect(run(title)).rejects.toMatchObject(
        error('Title is too generic. Describe the document.'),
      )
    },
  )
  it.each(['茶叶证', 'a'.repeat(150), '🌱🌱🌱', 'Product certification', '  年度茶叶检测报告  '])(
    'accepts descriptive title: %s',
    async (title) => {
      await expect(run(title)).resolves.toEqual({ title: title.trim() })
    },
  )
  it('skips untouched legacy titles during unrelated updates', async () => {
    for (const data of [{ description: 'Updated', title: 'document1' }, { _h_folders: null }]) {
      await expect(
        invoke({
          data,
          operation: 'update',
          originalDoc: { title: 'document1' },
          req: {},
        } as never),
      ).resolves.toEqual(data)
    }
  })
  it('validates replacements and explicit title changes', async () => {
    await expect(
      invoke({
        data: {},
        operation: 'update',
        originalDoc: { title: 'document1' },
        req: { file: {} },
      } as never),
    ).rejects.toMatchObject(error('Describe the document instead of using the file name.'))
    await expect(
      run(null, { operation: 'update', originalDoc: { title: 'Tea report' } }),
    ).rejects.toMatchObject(error('Title is required.'))
  })
})
