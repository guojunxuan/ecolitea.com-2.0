import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

let file: File | undefined
let initializing = false
let alt = ''
const setValue = vi.fn((value: string) => {
  alt = value
})
vi.mock('@payloadcms/ui', () => ({
  useFormInitializing: () => initializing,
  TextField: (props: { validate?: () => boolean }) => (
    <output data-validation={String(props.validate?.())} />
  ),
  useFormFields: (selector: (state: unknown[]) => unknown) => selector([{ file: { value: file } }]),
  useField: () => ({ value: alt, setValue }),
}))
import { AltPrefill } from '@/collections/mediaAdmin/AltPrefill'
import { DimensionsCell } from '@/collections/mediaAdmin/DimensionsCell'
import { FilesizeCell } from '@/collections/mediaAdmin/FilesizeCell'
import { formatFilesize } from 'payload/shared'

afterEach(() => {
  cleanup()
  alt = ''
  file = undefined
  initializing = false
  vi.clearAllMocks()
})
describe('Media Admin fields', () => {
  it('waits for native batch Form initialization before recording the selected File', () => {
    file = new File(['x'], 'Tea garden certificate.pdf')
    initializing = true
    const view = render(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    expect(setValue).not.toHaveBeenCalled()
    // The parent Form replaces initial state before its ready context flips.
    alt = ''
    initializing = false
    view.rerender(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    expect(setValue).toHaveBeenCalledWith('Tea garden certificate')
  })
  it('prefills only the final filename extension and disables client validation', () => {
    file = new File(['x'], 'tea.garden.hero.jpg')
    render(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    expect(setValue).toHaveBeenCalledWith('tea.garden.hero')
    expect(document.querySelector('output')?.dataset.validation).toBe('true')
  })
  it('preserves editor text', () => {
    alt = 'Tea in the morning'
    file = new File(['x'], 'image.jpg')
    render(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    expect(setValue).not.toHaveBeenCalled()
  })
  it('leaves a cleared alt empty until a new file is selected', () => {
    file = new File(['x'], 'first.image.jpg')
    const view = render(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    view.rerender(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    setValue.mockClear()
    alt = ''
    view.rerender(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    expect(setValue).not.toHaveBeenCalled()
    expect(alt).toBe('')
    file = new File(['x'], 'second.image.jpg')
    view.rerender(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
    expect(setValue).toHaveBeenCalledWith('second.image')
  })
  it('prefills separate batch forms independently', () => {
    for (const name of ['first.image.png', '第二张图像.webp']) {
      alt = ''
      file = new File(['x'], name)
      const view = render(<AltPrefill path="alt" field={{ name: 'alt', type: 'text' }} />)
      expect(setValue).toHaveBeenLastCalledWith(name.replace(/\.[^.]+$/, ''))
      view.unmount()
    }
  })
  it('renders display dimensions and Payload filesize formatting', () => {
    render(
      <>
        <DimensionsCell cellData={1356} rowData={{ height: 910 }} />
        <FilesizeCell cellData={10240} />
      </>,
    )
    expect(screen.getByText('1356 × 910')).toBeTruthy()
    expect(screen.getByText(formatFilesize(10240))).toBeTruthy()
  })
})
