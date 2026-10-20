import React from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Media } from '@/collections/Media'
import { Documents } from '@/collections/Documents'
import { DimensionsCell } from '@/collections/mediaAdmin/DimensionsCell'
import { TypeCell as MediaType } from '@/collections/mediaAdmin/TypeCell'
import { TypeCell as DocumentType } from '@/collections/Documents/admin/TypeCell'
import { UpdatedAtCell as MediaUpdatedAt } from '@/collections/mediaAdmin/UpdatedAtCell'
import { UpdatedAtCell as DocumentUpdatedAt } from '@/collections/Documents/admin/UpdatedAtCell'
import { FolderCell as MediaFolder } from '@/collections/mediaAdmin/FolderCell'
import { FolderCell as DocumentFolder } from '@/collections/Documents/admin/FolderCell'
import type { DefaultCellComponentProps } from 'payload'
vi.mock('@payloadcms/ui', () => ({
  DefaultCell: ({ cellData }: DefaultCellComponentProps) => (
    <span>{typeof cellData === 'object' ? cellData.name : cellData}</span>
  ),
}))
afterEach(cleanup)

describe('resource list presentation', () => {
  it.each([
    [
      Media,
      {
        filename: 'Name',
        alt: 'Alt text',
        mimeType: 'Type',
        width: 'Dimensions',
        filesize: 'Size',
        _h_folders: 'Folder',
        updatedAt: 'updatedAt',
      },
    ],
    [
      Documents,
      {
        title: 'Title',
        filename: 'File name',
        mimeType: 'Type',
        filesize: 'Size',
        _h_folders: 'Folder',
        updatedAt: 'updatedAt',
      },
    ],
  ])('labels and sorts $slug using public collection configuration', (collection, labels) => {
    expect(collection.defaultSort).toBe('-createdAt')
    for (const [name, label] of Object.entries(labels)) {
      expect(
        collection.fields.find((field) => 'name' in field && field.name === name),
      ).toMatchObject({ label })
    }
  })
  it.each([Media, Documents])(
    'keeps updatedAt available in $slug lists but out of edit forms',
    (collection) => {
      const field = collection.fields.find((field) => 'name' in field && field.name === 'updatedAt')
      expect(field?.admin?.condition?.({}, {}, {} as never)).toBe(false)
      expect(field?.admin).not.toHaveProperty('disableListColumn', true)
      expect(collection.admin?.defaultColumns).toContain('updatedAt')
    },
  )
  it('keeps editor guidance on the fields that own it', () => {
    expect(Media.fields.find((field) => 'name' in field && field.name === 'alt')).toMatchObject({
      admin: { description: 'Describe the image for screen readers and search engines.' },
    })
    expect(
      Documents.fields.find((field) => 'name' in field && field.name === 'title'),
    ).toMatchObject({ admin: { description: 'Shown to editors when choosing this document.' } })
    expect(
      Documents.fields.find((field) => 'name' in field && field.name === 'description'),
    ).toMatchObject({ maxLength: 300, admin: { description: 'Optional short summary.' } })
  })
  it.each([
    [MediaType, 'image/jpeg', 'JPEG'],
    [MediaType, 'image/png', 'PNG'],
    [MediaType, 'image/webp', 'WebP'],
    [MediaType, 'image/avif', 'AVIF'],
    [MediaType, 'image/gif', 'GIF'],
    [MediaType, 'video/mp4', 'MP4'],
    [DocumentType, 'application/pdf', 'PDF'],
    [
      DocumentType,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Word',
    ],
    [DocumentType, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel'],
    [
      DocumentType,
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'PowerPoint',
    ],
    [MediaType, null, '—'],
    [DocumentType, null, '—'],
  ])('renders readable file type %s %s', (Cell, value, expected) => {
    render(<Cell cellData={value} />)
    expect(screen.getByText(expected)).toBeTruthy()
  })
  it.each([MediaUpdatedAt, DocumentUpdatedAt])(
    'formats dates independently of the global Admin date format',
    (Cell) => {
      const view = render(<Cell cellData="2026-10-18T12:34:56.000Z" />)
      expect(screen.getByText('Oct 18, 2026')).toBeTruthy()
      view.rerender(<Cell cellData="invalid" />)
      expect(screen.getByText('—')).toBeTruthy()
      view.rerender(<Cell />)
      expect(screen.getByText('—')).toBeTruthy()
    },
  )
  it.each([MediaFolder, DocumentFolder])('replaces only an empty folder with a dash', (Cell) => {
    const props = {
      field: { name: '_h_folders', type: 'relationship', relationTo: 'folders' },
      rowData: { id: 'file-1' },
      collectionSlug: 'media',
      cellData: null,
    } as DefaultCellComponentProps
    const view = render(<Cell {...props} cellData={null} />)
    expect(screen.getByText('—')).toBeTruthy()
    view.rerender(<Cell {...props} cellData={{ id: 'folder-1', name: 'Press kit' }} />)
    expect(screen.getByText('Press kit')).toBeTruthy()
  })
  it('appends duration only to video dimensions and omits missing duration', () => {
    const view = render(
      <DimensionsCell
        cellData={1920}
        rowData={{ height: 1080, mimeType: 'video/mp4', durationSeconds: 45.8 }}
      />,
    )
    expect(screen.getByText('1920 × 1080 · 0:45')).toBeTruthy()
    view.rerender(
      <DimensionsCell
        cellData={1920}
        rowData={{ height: 1080, mimeType: 'video/mp4', durationSeconds: 600 }}
      />,
    )
    expect(screen.getByText('1920 × 1080 · 10:00')).toBeTruthy()
    view.rerender(
      <DimensionsCell
        cellData={1356}
        rowData={{ height: 910, mimeType: 'image/jpeg', durationSeconds: 45 }}
      />,
    )
    expect(screen.getByText('1356 × 910')).toBeTruthy()
    view.rerender(
      <DimensionsCell cellData={1920} rowData={{ height: 1080, mimeType: 'video/mp4' }} />,
    )
    expect(screen.getByText('1920 × 1080')).toBeTruthy()
  })
  it('selects video metadata with width so duration survives narrow list queries', async () => {
    const select = { width: true, filename: true }
    expect(await Media.select?.({ select } as never)).toMatchObject({
      height: true,
      mimeType: true,
      durationSeconds: true,
    })
    expect(select).toEqual({ width: true, filename: true })
  })
})
