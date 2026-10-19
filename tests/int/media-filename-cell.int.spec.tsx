import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import type { DefaultCellComponentProps } from 'payload'

const defaultCell = vi.hoisted(() => vi.fn())
vi.mock('@payloadcms/ui', () => ({
  DefaultCell: (props: DefaultCellComponentProps) => {
    defaultCell(props)
    return <a href={props.linkURL}>{props.cellData}</a>
  },
}))
import { FilenameCell } from '@/collections/mediaAdmin/FilenameCell'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
it.each([
  ['截屏2026-08-12 11.22.23.png', '截屏2026-08-12 11.22.23'],
  ['tea.garden.hero.jpg', 'tea.garden.hero'],
  ['video.MP4', 'video'],
  ['filename', 'filename'],
])('displays %s without its final extension and preserves native navigation', (filename, label) => {
  const rowData = { id: 'media-1', filename }
  render(
    <FilenameCell
      cellData={filename}
      collectionSlug="media"
      field={{ name: 'filename', type: 'text' }}
      rowData={rowData}
      link
      linkURL="/admin/collections/media/media-1"
    />,
  )
  expect(screen.getByRole('link').textContent).toBe(label)
  expect(defaultCell).toHaveBeenCalledWith(
    expect.objectContaining({ rowData, link: true, linkURL: '/admin/collections/media/media-1' }),
  )
  expect(rowData.filename).toBe(filename)
})
