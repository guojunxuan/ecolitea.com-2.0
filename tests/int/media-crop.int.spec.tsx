import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadEdits } from 'payload'

let file: File | undefined
let edits: UploadEdits = {}
const update = vi.fn((next: UploadEdits) => {
  edits = { ...edits, ...next }
})
const modified = vi.fn()
vi.mock('@payloadcms/ui', () => ({
  useFormFields: (selector: (state: unknown[]) => unknown) => selector([{ file: { value: file } }]),
  useDocumentInfo: () => ({ data: undefined }),
  useUploadEdits: () => ({ uploadEdits: edits, updateUploadEdits: update }),
  useForm: () => ({ setModified: modified }),
}))
import { ImageCropControls } from '@/collections/mediaAdmin/ImageCropControls'

const load = (width: number, height: number) => {
  const image = screen.getByAltText('Crop source')
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  })
  fireEvent.load(image)
}
beforeEach(() => {
  file = new File(['image'], 'tea.jpg', { type: 'image/jpeg' })
  edits = {}
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: vi.fn(() => 'blob:test-image'),
      revokeObjectURL: vi.fn(),
    }),
  )
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('locked Media crop controls', () => {
  it('keeps an active object URL when React StrictMode remounts effects', () => {
    const revoked: string[] = []
    let count = 0
    vi.spyOn(URL, 'createObjectURL').mockImplementation(() => `blob:source-${++count}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url) => revoked.push(url))
    render(
      <React.StrictMode>
        <ImageCropControls />
      </React.StrictMode>,
    )
    expect(revoked).not.toContain(screen.getByAltText('Crop source').getAttribute('src'))
  })
  it('does not open automatically for an allowed ratio', () => {
    render(<ImageCropControls />)
    load(1600, 1200)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('opens only invalid images, chooses the closest ratio, and offers six locked ratios', () => {
    render(<ImageCropControls />)
    load(1100, 1000)
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect((screen.getByLabelText('Aspect ratio') as HTMLSelectElement).value).toBe('1:1')
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      '1:1',
      '4:3',
      '3:2',
      '16:9',
      '9:16',
      '4:5',
    ])
    fireEvent.change(screen.getByLabelText('Aspect ratio'), { target: { value: '16:9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        crop: expect.objectContaining({ unit: '%' }),
        widthInPixels: 1100,
        heightInPixels: 619,
      }),
    )
    expect(modified).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('cancels without submitting crop edits', () => {
    render(<ImageCropControls />)
    load(1100, 1000)
    update.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(update).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('resets a prior crop when a file is replaced while preserving native focal edits', () => {
    const view = render(<ImageCropControls />)
    load(1100, 1000)
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    edits.focalPoint = { x: 0, y: 100 }
    file = new File(['replacement'], 'tea-new.jpg', { type: 'image/jpeg' })
    view.rerender(<ImageCropControls />)
    expect(edits.crop).toBeUndefined()
    expect(edits.widthInPixels).toBeUndefined()
    expect(edits.focalPoint).toEqual({ x: 0, y: 100 })
    load(1600, 1200)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('leaves video files alone', () => {
    file = new File(['video'], 'tea.mp4', { type: 'video/mp4' })
    render(<ImageCropControls />)
    expect(screen.queryByAltText('Crop source')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('isolates crop state in separate batch upload forms', () => {
    for (const name of ['first.jpg', 'second.jpg']) {
      file = new File(['image'], name, { type: 'image/jpeg' })
      const view = render(<ImageCropControls />)
      load(1100, 1000)
      expect((screen.getByLabelText('Aspect ratio') as HTMLSelectElement).value).toBe('1:1')
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
      view.unmount()
    }
  })
})
