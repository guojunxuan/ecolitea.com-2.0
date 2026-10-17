import { cleanup, render, screen } from '@testing-library/react'
import React from 'react'
import { formatFilesize } from 'payload/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
let file: File | undefined
let title = ''
const setValue = vi.fn((value: string) => {
  title = value
})
vi.mock('@payloadcms/ui', () => ({
  TextField: (props: { validate?: () => boolean }) => (
    <output data-validation={String(props.validate?.())} />
  ),
  useField: () => ({ value: title, setValue }),
  useFormFields: (selector: (state: unknown[]) => unknown) => selector([{ file: { value: file } }]),
}))
import { TitlePrefill } from '@/collections/Documents/admin/TitlePrefill'
import { FilesizeCell } from '@/collections/Documents/admin/FilesizeCell'
const field = () => <TitlePrefill path="title" field={{ name: 'title', type: 'text' }} />
afterEach(() => {
  cleanup()
  file = undefined
  title = ''
  vi.clearAllMocks()
})
describe('Documents Admin fields', () => {
  it('prefills basename without rewriting punctuation and keeps server validation authoritative', () => {
    file = new File(['x'], 'tea.certification.2026.pdf')
    render(field())
    expect(setValue).toHaveBeenCalledWith('tea.certification.2026')
    expect(document.querySelector('output')?.dataset.validation).toBe('true')
  })
  it('preserves existing editor text', () => {
    title = 'Organic certification'
    file = new File(['x'], 'scan_001.pdf')
    render(field())
    expect(setValue).not.toHaveBeenCalled()
  })
  it('allows clearing until a different File identity is selected', () => {
    file = new File(['x'], 'first.pdf')
    const view = render(field())
    title = ''
    setValue.mockClear()
    view.rerender(field())
    expect(setValue).not.toHaveBeenCalled()
    file = new File(['x'], 'first.pdf')
    view.rerender(field())
    expect(setValue).toHaveBeenCalledWith('first')
  })
  it('prefills each batch form independently', () => {
    for (const name of ['Organic certificate.pdf', '茶叶检测报告.docx']) {
      file = new File(['x'], name)
      title = ''
      const view = render(field())
      expect(setValue).toHaveBeenLastCalledWith(name.replace(/\.[^.]+$/, ''))
      view.unmount()
    }
  })
  it('uses Payload filesize formatting and handles missing metadata', () => {
    render(
      <>
        <FilesizeCell cellData={10000000} />
        <FilesizeCell />
      </>,
    )
    expect(screen.getByText(formatFilesize(10000000))).toBeTruthy()
    expect(screen.getByText('—')).toBeTruthy()
  })
})
