import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UploadEdits } from 'payload'

let file: File | null | undefined
let data: { mimeType: string; url: string } | undefined
let edits: UploadEdits = {}
const update = vi.fn((next: UploadEdits) => {
  edits = { ...edits, ...next }
})
const modified = vi.fn()
const setBackgroundProcessing = vi.fn()
const clearFile = vi.fn((value: null) => {
  file = value
})
let modalState: Record<string, { isOpen: boolean }> = {}
const listeners = new Set<() => void>()
const changeModal = (slug: string, isOpen: boolean) => {
  modalState = { ...modalState, [slug]: { isOpen } }
  listeners.forEach((listener) => listener())
}
const openModal = (slug: string) => changeModal(slug, true)
const closeModal = (slug: string) => changeModal(slug, false)
vi.mock('@payloadcms/ui', () => ({
  useFormFields: (selector: (state: unknown[]) => unknown) => selector([{ file: { value: file } }]),
  useField: () => ({ setValue: clearFile }),
  useDocumentInfo: () => ({ data }),
  useUploadEdits: () => ({
    uploadEdits: edits,
    getUploadEdits: () => edits,
    updateUploadEdits: update,
  }),
  useForm: () => ({ setModified: modified, setBackgroundProcessing }),
  useModal: () => ({
    modalState: React.useSyncExternalStore(
      (callback) => {
        listeners.add(callback)
        return () => listeners.delete(callback)
      },
      () => modalState,
    ),
    openModal,
    closeModal,
  }),
  DialogModal: ({ children, slug }: { children: React.ReactNode; slug: string }) =>
    modalState[slug]?.isOpen ? (
      <div role="dialog" data-slug={slug}>
        {children}
      </div>
    ) : null,
  DialogHeader: ({ title, onClose }: { title: string; onClose: () => void }) => (
    <header>
      <h2>{title}</h2>
      <button onClick={onClose}>Close</button>
    </header>
  ),
  DialogBody: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <footer>{children}</footer>,
  DialogCancel: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  DialogConfirm: ({ label, onClick }: { label: string; onClick: () => void }) => (
    <button onClick={onClick}>{label}</button>
  ),
  Banner: ({ children }: { children: React.ReactNode }) => <aside>{children}</aside>,
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode
    onClick: () => void
    disabled: boolean
  }) => (
    <button onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
  Tabs: ({
    tabs,
    value,
    onChange,
  }: {
    tabs: { label: string; value: string }[]
    value: string
    onChange: (value: string) => void
  }) => (
    <div role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          role="tab"
          aria-selected={value === tab.value}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
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
  data = undefined
  edits = {}
  modalState = {}
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-image')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.clearAllMocks()
})

describe('locked Media crop controls', () => {
  it('keeps an active object URL when StrictMode remounts effects', () => {
    const revoked: string[] = []
    let count = 0
    vi.mocked(URL.createObjectURL).mockImplementation(() => `blob:source-${++count}`)
    vi.mocked(URL.revokeObjectURL).mockImplementation((url) => revoked.push(url))
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
    expect(screen.queryByRole('button', { name: 'Crop image' })).toBeNull()
  })
  it('explains invalid dimensions, selects the nearest ratio and updates the result', () => {
    render(<ImageCropControls />)
    load(1000, 210)
    expect(screen.getByRole('heading').textContent).toBe('Crop image to a supported ratio')
    expect(screen.getByText(/This image is 1000 × 210 \(4.76:1\)/)).toBeTruthy()
    expect(screen.getByRole('tab', { name: '16:9' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      '1:1',
      '4:3',
      '3:2',
      '16:9',
      '9:16',
      '4:5',
    ])
    expect(screen.getByText('Result: 373 × 210 · 16:9')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: '1:1' }))
    expect(screen.getByText('Result: 210 × 210 · 1:1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        widthInPixels: 210,
        heightInPixels: 210,
        crop: expect.objectContaining({ unit: '%' }),
      }),
    )
    expect(modified).toHaveBeenCalledWith(true)
    expect(clearFile).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it.each(['Choose another file', 'Close'])('clears an invalid selected file on %s', (label) => {
    render(<ImageCropControls />)
    load(1100, 1000)
    update.mockClear()
    fireEvent.click(screen.getByRole('button', { name: label }))
    expect(clearFile).toHaveBeenCalledWith(null)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(edits.crop).toBeUndefined()
  })
  it('clears an invalid selected file when Payload closes the modal with Escape', () => {
    render(<ImageCropControls />)
    load(1100, 1000)
    const slug = screen.getByRole('dialog').getAttribute('data-slug')!
    act(() => changeModal(slug, false))
    expect(clearFile).toHaveBeenCalledWith(null)
  })
  it.each([undefined, null])(
    'does not load or expose crop controls for a saved image with file=%s',
    (value) => {
      file = value
      data = { mimeType: 'image/jpeg', url: '/existing.jpg' }
      render(<ImageCropControls />)
      expect(screen.queryByAltText('Crop source')).toBeNull()
      expect(screen.queryByRole('button', { name: 'Crop image' })).toBeNull()
      expect(screen.queryByRole('dialog')).toBeNull()
    },
  )
  it('reads cached newly selected image dimensions without waiting for load', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(1000)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(210)
    render(<ImageCropControls />)
    expect(screen.getByRole('heading').textContent).toBe('Crop image to a supported ratio')
    expect(screen.getByText('Result: 373 × 210 · 16:9')).toBeTruthy()
  })
  it('preserves an applied crop through native filename changes', async () => {
    const view = render(<ImageCropControls />)
    load(1000, 210)
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    const applied = { ...edits }
    file = new File([file!], 'renamed.jpg', { type: file!.type, lastModified: file!.lastModified })
    view.rerender(<ImageCropControls />)
    await screen.findByAltText('Crop source')
    load(1000, 210)
    expect(edits).toEqual(applied)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('still inspects a renamed image when its original dimensions have not loaded', async () => {
    const view = render(<ImageCropControls />)
    file = new File([file!], 'renamed.jpg', { type: file!.type, lastModified: file!.lastModified })
    view.rerender(<ImageCropControls />)
    await screen.findByAltText('Crop source')
    load(1000, 210)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('preserves crop when a pending rename returns to the original filename', async () => {
    const view = render(<ImageCropControls />)
    load(1000, 210)
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    const original = file!
    const applied = { ...edits }
    const read = vi
      .spyOn(FileReader.prototype, 'readAsArrayBuffer')
      .mockImplementationOnce(() => {})
    file = new File([original], 'renamed.jpg', {
      type: original.type,
      lastModified: original.lastModified,
    })
    view.rerender(<ImageCropControls />)
    file = new File([original], original.name, {
      type: original.type,
      lastModified: original.lastModified,
    })
    view.rerender(<ImageCropControls />)
    await screen.findByAltText('Crop source')
    await act(async () => {
      const pending = read.mock.contexts[0] as FileReader
      Object.defineProperty(pending, 'result', { value: new TextEncoder().encode('image').buffer })
      pending.dispatchEvent(new ProgressEvent('load'))
    })
    load(1000, 210)
    expect(edits).toEqual(applied)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('ignores a stale rename comparison after a different file is selected', async () => {
    const view = render(<ImageCropControls />)
    load(1000, 210)
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    const read = vi
      .spyOn(FileReader.prototype, 'readAsArrayBuffer')
      .mockImplementationOnce(() => {})
    file = new File([file!], 'renamed.jpg', { type: file!.type, lastModified: file!.lastModified })
    view.rerender(<ImageCropControls />)
    expect(edits.crop).toBeUndefined()
    file = new File(['replacement'], 'new.jpg', { type: 'image/jpeg' })
    view.rerender(<ImageCropControls />)
    load(1600, 1200)
    await act(async () => {
      const pending = read.mock.contexts[0] as FileReader
      Object.defineProperty(pending, 'result', { value: new TextEncoder().encode('image').buffer })
      pending.dispatchEvent(new ProgressEvent('load'))
    })
    expect(edits.crop).toBeUndefined()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('resets a replacement even when its metadata matches a renamed source', async () => {
    const view = render(<ImageCropControls />)
    load(1000, 210)
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    file = new File(['other'], 'replacement.jpg', {
      type: file!.type,
      lastModified: file!.lastModified,
    })
    view.rerender(<ImageCropControls />)
    await screen.findByAltText('Crop source')
    load(1000, 210)
    expect(edits.crop).toBeUndefined()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })
  it('resets prior crop on replacement and preserves focal edits', () => {
    const view = render(<ImageCropControls />)
    load(1100, 1000)
    fireEvent.click(screen.getByRole('button', { name: 'Apply crop' }))
    edits.focalPoint = { x: 0, y: 100 }
    file = new File(['x'], 'replacement.jpg', { type: 'image/jpeg' })
    view.rerender(<ImageCropControls />)
    expect(edits.crop).toBeUndefined()
    expect(edits.focalPoint).toEqual({ x: 0, y: 100 })
    load(1600, 1200)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('leaves videos alone', () => {
    file = new File(['x'], 'video.mp4', { type: 'video/mp4' })
    render(<ImageCropControls />)
    expect(screen.queryByAltText('Crop source')).toBeNull()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
