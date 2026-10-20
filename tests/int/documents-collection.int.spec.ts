// @vitest-environment node
import { mongooseAdapter, type MongooseAdapter } from '@payloadcms/db-mongodb'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import {
  buildConfig,
  getPayload,
  validations,
  type Payload,
  type TextFieldValidation,
} from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { Documents } from '@/collections/Documents'
import { validateDocumentUpload } from '@/collections/Documents/validateDocumentUpload'
import { validateTitle } from '@/collections/Documents/validateTitle'
import { createIsolatedTestDatabaseURI } from '../helpers/isolatedDatabase'
import { officeEntries, officeTypes, validPDF, zip } from '../helpers/documentFixtures'

const file = (data: Buffer = validPDF, name = 'report.pdf', mimetype = 'application/pdf') => ({
  data,
  name,
  mimetype,
  size: data.length,
})

describe('Documents collection contract', () => {
  it('owns native resource configuration and folders', () => {
    expect(Documents).toMatchObject({
      slug: 'documents',
      labels: { singular: 'Document', plural: 'Documents' },
      versions: false,
      disableDuplicate: true,
      admin: {
        useAsTitle: 'title',
        defaultColumns: ['title', 'filename', 'mimeType', 'filesize', '_h_folders', 'updatedAt'],
        listSearchableFields: ['title', 'filename'],
      },
      upload: { crop: false, focalPoint: false },
    })
    expect(Documents.hooks?.beforeValidate).toEqual([validateDocumentUpload, validateTitle])
    expect(Documents.upload).not.toHaveProperty('imageSizes')
    expect(Documents.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'title', required: true, index: true }),
        expect.objectContaining({ name: '_h_folders', relationTo: 'folders' }),
      ]),
    )
    expect(Documents.admin?.description).toContain('10 MB')
  })
  it('allows public reads and authenticates all writes', async () => {
    expect(await Documents.access!.read!({ req: {} } as never)).toBe(true)
    for (const operation of ['create', 'update', 'delete'] as const) {
      expect(await Documents.access![operation]!({ req: {} } as never)).toBe(false)
      expect(await Documents.access![operation]!({ req: { user: { id: 'user' } } } as never)).toBe(
        true,
      )
    }
  })
})

describe('Documents uploads through real Payload Local API', () => {
  let payload: Payload
  let directory: string
  let databaseURI: string
  beforeAll(async () => {
    databaseURI = createIsolatedTestDatabaseURI(`ecolitea2-documents-test-${randomUUID()}`)
    directory = await mkdtemp(path.join(tmpdir(), 'documents-api-'))
    console.info(
      `Documents tests target database: ${databaseURI}; storage: ${directory}; DISABLE_R2_STORAGE=${process.env.DISABLE_R2_STORAGE}`,
    )
    expect(process.env.DISABLE_R2_STORAGE).toBe('true')
    const config = await buildConfig({
      secret: 'documents-isolated-test-secret-at-least-32-characters',
      email: () => ({
        name: 'documents-test-no-email',
        defaultFromAddress: 'documents-test@example.invalid',
        defaultFromName: 'Documents tests',
        sendEmail: async () => {
          throw new Error('Documents upload tests must not send email.')
        },
      }),
      collections: [
        {
          slug: 'folders',
          folders: true,
          fields: [{ name: 'name', type: 'text', required: true }],
        },
        {
          ...Documents,
          fields: Documents.fields.map((field) =>
            field.type === 'text' && !field.hasMany && field.name === 'title'
              ? {
                  ...field,
                  validate: (
                    value: Parameters<TextFieldValidation>[0],
                    args: Parameters<TextFieldValidation>[1],
                  ) =>
                    args.req.context.seedLegacyTitle
                      ? true
                      : (field.validate ?? validations.text)(value, args),
                }
              : field,
          ),
          upload: { ...(Documents.upload as object), staticDir: directory },
          hooks: {
            ...Documents.hooks,
            beforeChange: [
              ({ data, req }) =>
                req.context.seedLegacyTitle === 'empty' ? { ...data, title: '' } : data,
            ],
            beforeValidate: [
              validateDocumentUpload,
              (args) => (args.req.context.seedLegacyTitle ? args.data : validateTitle(args)),
            ],
          },
        },
      ],
      db: mongooseAdapter({ url: databaseURI, connectOptions: { serverSelectionTimeoutMS: 3000 } }),
    })
    payload = await getPayload({ config, key: databaseURI })
  }, 15000)
  afterAll(async () => {
    if (payload) {
      console.info(`Dropping only isolated Documents test database: ${databaseURI}`)
      await (payload.db as MongooseAdapter).connection.dropDatabase()
      await payload.destroy()
    }
    if (directory) await rm(directory, { recursive: true, force: true })
  })
  it('accepts a 300-character summary and rejects longer descriptions through native validation', async () => {
    const doc = await payload.create({
      collection: 'documents',
      data: { title: 'Tea certificate with summary', description: 'a'.repeat(300) },
      file: file(),
    })
    expect(doc.description).toHaveLength(300)
    await expect(
      payload.update({
        collection: 'documents',
        id: doc.id,
        data: { description: 'a'.repeat(301) },
      }),
    ).rejects.toMatchObject({
      data: { errors: expect.arrayContaining([expect.objectContaining({ path: 'description' })]) },
    })
  })
  it('creates valid PDF and all Office files', async () => {
    await expect(
      payload.create({
        collection: 'documents',
        data: { title: 'Tea certification' },
        file: file(),
      }),
    ).resolves.toMatchObject({ title: 'Tea certification', mimeType: 'application/pdf' })
    for (const extension of Object.keys(officeTypes) as (keyof typeof officeTypes)[]) {
      await expect(
        payload.create({
          collection: 'documents',
          data: { title: 'Product specification' },
          file: file(
            zip(officeEntries(extension)),
            `spec.${extension}`,
            officeTypes[extension].mime,
          ),
        }),
      ).resolves.toMatchObject({
        title: 'Product specification',
        mimeType: officeTypes[extension].mime,
      })
    }
  })
  it.each([
    [
      'declared MIME',
      () => file(validPDF, 'bad.doc', 'application/msword'),
      'Unsupported file type. Use PDF, Word (.docx), Excel (.xlsx) or PowerPoint (.pptx).',
    ],
    [
      'byte limit',
      () => file(Buffer.alloc(10_000_001), 'bad.docx'),
      'File is too large (10 MB). Maximum is 10 MB.',
    ],
    [
      'extension',
      () => file(validPDF, 'bad.docx'),
      "File extension doesn't match its content. Save it again as .pdf.",
    ],
    ['native PDF structure', () => file(Buffer.from('%PDF-1.7\nmalformed')), 'Invalid PDF file.'],
    [
      'disguised ZIP',
      () =>
        file(zip({ 'readme.txt': 'not an Office document' }), 'fake.docx', officeTypes.docx.mime),
      "This Word file can't be read. Try saving it again.",
    ],
    [
      'Office macros',
      () =>
        file(
          zip({ ...officeEntries('docx'), 'word/vbaProject.bin': 'x' }),
          'macro.docx',
          officeTypes.docx.mime,
        ),
      "Files with macros aren't allowed.",
    ],
  ] as const)('rejects %s before storage writes', async (_, makeFile, message) => {
    const before = await readdir(directory)
    const expectedPDFLog =
      message === 'Invalid PDF file.'
        ? vi.spyOn(payload.logger, 'error').mockImplementation(() => undefined)
        : undefined
    try {
      const result = expect(
        payload.create({
          collection: 'documents',
          data: { title: 'Tea certification' },
          file: makeFile(),
        }),
      ).rejects
      if (message === 'Invalid PDF file.') {
        await result.toMatchObject({ data: { errors: [{ path: 'file', message }] } })
        expect(expectedPDFLog?.mock.calls).toEqual([['Invalid PDF file.']])
      } else await result.toThrow(message)
    } finally {
      expectedPDFLog?.mockRestore()
    }
    expect(await readdir(directory)).toEqual(before)
  })
  it('enforces exact 10 MB boundary through the API', async () => {
    const bytes = Buffer.alloc(10_000_000, 32)
    validPDF.copy(bytes)
    Buffer.from('xref\n%%EOF').copy(bytes, bytes.length - 10)
    await expect(
      payload.create({
        collection: 'documents',
        data: { title: 'Detailed certification' },
        file: file(bytes),
      }),
    ).resolves.toMatchObject({ filesize: 10_000_000 })
  })
  it('validates new titles before storage writes', async () => {
    const before = await readdir(directory)
    await expect(
      payload.create({ collection: 'documents', data: { title: 'document1' }, file: file() }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          {
            path: 'title',
            message: 'Describe the document instead of using the file name.',
          },
        ],
      },
    })
    expect(await readdir(directory)).toEqual(before)
  })
  it('permits metadata updates on an empty legacy title', async () => {
    const legacy = await payload.create({
      collection: 'documents',
      data: { title: 'Legacy placeholder' },
      file: file(),
      context: { seedLegacyTitle: 'empty' },
    })
    await expect(
      payload.update({
        collection: 'documents',
        id: legacy.id,
        data: { description: 'Historical certificate' },
      }),
    ).resolves.toMatchObject({ title: '', description: 'Historical certificate' })
  })
  it('preserves invalid legacy titles on description/folder updates but validates replacements and title changes', async () => {
    const legacy = await payload.create({
      collection: 'documents',
      data: { title: 'document1' },
      file: file(),
      context: { seedLegacyTitle: true },
    })
    const folder = await payload.create({ collection: 'folders', data: { name: 'Certifications' } })
    await expect(
      payload.update({
        collection: 'documents',
        id: legacy.id,
        data: { title: 'document1', description: 'Updated', _h_folders: folder.id },
        depth: 0,
      }),
    ).resolves.toMatchObject({ title: 'document1', description: 'Updated', _h_folders: folder.id })
    await expect(
      payload.update({ collection: 'documents', id: legacy.id, data: { _h_folders: null } }),
    ).resolves.toMatchObject({ title: 'document1', _h_folders: null })
    await expect(
      payload.update({ collection: 'documents', id: legacy.id, data: {}, file: file() }),
    ).rejects.toMatchObject({
      data: {
        errors: [
          {
            path: 'title',
            message: 'Describe the document instead of using the file name.',
          },
        ],
      },
    })
    await expect(
      payload.update({ collection: 'documents', id: legacy.id, data: { title: 'file' } }),
    ).rejects.toMatchObject({
      data: {
        errors: [{ path: 'title', message: 'Title is too generic. Describe the document.' }],
      },
    })
    await expect(
      payload.findByID({ collection: 'documents', id: legacy.id, overrideAccess: false }),
    ).resolves.toMatchObject({ title: 'document1' })
  })
})
