import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { DefaultCellComponentProps } from 'payload'

const native = vi.hoisted(() => ({ cell: vi.fn(), shell: vi.fn(), select: vi.fn(), drawer: false }))
vi.mock('@payloadcms/ui', () => {
  const DefaultCell = (props: DefaultCellComponentProps) => {
    native.cell(props)
    if (props.onClick)
      return (
        <button
          type="button"
          onClick={() =>
            props.onClick?.({
              cellData: props.cellData,
              collectionSlug: props.collectionSlug,
              rowData: props.rowData,
            })
          }
        >
          {props.cellData}
        </button>
      )
    return props.link ? <a href={props.linkURL}>{props.cellData}</a> : <span>{props.cellData}</span>
  }
  return {
    DefaultCell,
    // Model the installed public wrapper's contract: drawer selection belongs to
    // RenderDefaultCell, not the formatting-only custom cell.
    RenderDefaultCell: ({
      clientProps,
      isLinkedColumn,
      ...rest
    }: {
      clientProps: DefaultCellComponentProps
      isLinkedColumn?: boolean
      columnIndex: number
    }) => {
      native.shell({ clientProps, isLinkedColumn, ...rest })
      const props = { ...clientProps }
      if (native.drawer && isLinkedColumn && props.link !== false) {
        props.link = false
        props.onClick = ({ collectionSlug, rowData }) =>
          native.select({ collectionSlug, doc: rowData, docID: rowData.id })
      }
      return <DefaultCell {...props} />
    },
  }
})
import { FilenameCell } from '@/collections/mediaAdmin/FilenameCell'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  native.drawer = false
})
const props = (filename: string): DefaultCellComponentProps => ({
  cellData: filename,
  collectionSlug: 'media',
  field: { name: 'filename', type: 'text' },
  rowData: { id: 'media-1', filename },
  link: true,
  linkURL: '/admin/collections/media/media-1',
})
it.each([
  ['截屏2026-08-12 11.22.23.png', '截屏2026-08-12 11.22.23'],
  ['tea.garden.hero.jpg', 'tea.garden.hero'],
  ['video.MP4', 'video'],
  ['filename', 'filename'],
])('displays %s without its final extension and preserves native navigation', (filename, label) => {
  const input = props(filename)
  render(<FilenameCell {...input} />)
  expect(screen.getByRole('link').textContent).toBe(label)
  expect(native.cell).toHaveBeenCalledWith(
    expect.objectContaining({ rowData: input.rowData, link: true, linkURL: input.linkURL }),
  )
  expect(input.rowData.filename).toBe(filename)
})
it('delegates drawer selection to the native wrapper without generating a navigation link', () => {
  native.drawer = true
  const input = props('media.image.jpg')
  render(<FilenameCell {...input} columnIndex={2} />)
  expect(native.shell).toHaveBeenCalledWith(
    expect.objectContaining({
      columnIndex: 2,
      isLinkedColumn: true,
      clientProps: expect.objectContaining({ cellData: 'media.image', rowData: input.rowData }),
    }),
  )
  expect(screen.queryByRole('link')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: 'media.image' }))
  expect(native.select).toHaveBeenCalledExactlyOnceWith({
    collectionSlug: 'media',
    doc: input.rowData,
    docID: 'media-1',
  })
  expect(input.rowData.filename).toBe('media.image.jpg')
})
it('keeps nonlinked columns noninteractive inside the drawer', () => {
  native.drawer = true
  render(<FilenameCell {...props('image.png')} link={false} />)
  expect(screen.queryByRole('button')).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
  expect(native.shell).toHaveBeenCalledWith(expect.objectContaining({ isLinkedColumn: false }))
})
