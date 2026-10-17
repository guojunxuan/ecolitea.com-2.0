import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { DOCUMENT_UPLOAD_POLICY } from '@/collections/Documents/uploadPolicy'
import { validateDocumentUpload } from '@/collections/Documents/validateDocumentUpload'
import { validateOfficeArchive } from '@/collections/Documents/officeArchive'
import { officeEntries, officeTypes, validPDF, zip } from '../helpers/documentFixtures'

const run = async (data: Buffer = validPDF, overrides = {}, metadata = {}) =>
  validateDocumentUpload({
    data: metadata,
    req: {
      file: {
        data,
        name: 'report.pdf',
        mimetype: 'application/pdf',
        size: data.length,
        ...overrides,
      },
    },
  } as never)

describe('Document uploads', () => {
  it('sets the byte limit', () => expect(DOCUMENT_UPLOAD_POLICY.maxBytes).toBe(10_000_000))
  it('skips file checks on metadata updates', async () => {
    const data = { title: 'Tea certification' }
    await expect(validateDocumentUpload({ data, req: {} } as never)).resolves.toBe(data)
  })
  it.each(Object.entries(officeTypes))('accepts %s', async (extension, type) => {
    const bytes = zip(officeEntries(extension as keyof typeof officeTypes))
    await expect(run(bytes, { name: `report.${extension}`, mimetype: type.mime })).resolves.toEqual(
      {},
    )
  })
  it('accepts exactly 10 MB and rejects one byte over using actual bytes', async () => {
    await expect(run(Buffer.alloc(10_000_000))).resolves.toEqual({})
    await expect(run(Buffer.alloc(10_000_001), { size: 1 })).rejects.toThrow(
      'File size exceeds the maximum of 10 MB.',
    )
  })
  it('uses all observed size sources and preserves error order', async () => {
    await expect(run(validPDF, { size: 10_000_001 })).rejects.toThrow(
      'File size exceeds the maximum of 10 MB.',
    )
    await expect(run(validPDF, {}, { filesize: 10_000_001 })).rejects.toThrow(
      'File size exceeds the maximum of 10 MB.',
    )
    await expect(
      run(validPDF, { mimetype: 'text/plain', size: 10_000_001, name: 'file.doc' }),
    ).rejects.toThrow(
      'Unsupported file type: text/plain. Documents accepts PDF, Word (.docx), Excel (.xlsx) and PowerPoint (.pptx).',
    )
    await expect(run(validPDF, { name: 'file.docx', size: 10_000_001 })).rejects.toThrow(
      'File size exceeds the maximum of 10 MB.',
    )
  })
  it('observes temporary files before reading them', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'documents-upload-'))
    try {
      const tempFilePath = path.join(directory, 'large.pdf')
      await writeFile(tempFilePath, Buffer.alloc(10_000_001))
      await expect(run(Buffer.alloc(0), { tempFilePath, size: 0 })).rejects.toThrow(
        'File size exceeds the maximum of 10 MB.',
      )
      await writeFile(tempFilePath, zip(officeEntries('docx')))
      await expect(
        run(Buffer.alloc(0), {
          tempFilePath,
          size: 0,
          name: 'report.docx',
          mimetype: officeTypes.docx.mime,
        }),
      ).resolves.toEqual({})
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })
  it.each(['doc', 'docm', 'xls', 'xlsm', 'ppt', 'pptm', 'zip', ''])(
    'rejects inconsistent extension %s',
    async (extension) => {
      await expect(run(validPDF, { name: `report.${extension}` })).rejects.toThrow(
        `File extension ".${extension}" does not match its type (.pdf).`,
      )
    },
  )
  it('accepts uppercase extension', async () =>
    await expect(run(validPDF, { name: 'REPORT.PDF' })).resolves.toEqual({}))
})

describe('Bounded Office archive integrity', () => {
  it.each(Object.keys(officeTypes))('accepts stored and deflated %s', (extension) => {
    for (const deflate of [false, true])
      expect(() =>
        validateOfficeArchive(
          zip(officeEntries(extension as keyof typeof officeTypes), deflate),
          extension as keyof typeof officeTypes,
        ),
      ).not.toThrow()
  })
  it.each([
    ['fake ZIP', () => Buffer.from('PK\x03\x04not a zip')],
    ['missing content types', () => zip({ 'word/document.xml': '<document/>' })],
    ['wrong main type', () => zip(officeEntries('xlsx'))],
    [
      'commented main type',
      () => {
        const entries = officeEntries('docx')
        entries['[Content_Types].xml'] = entries['[Content_Types].xml']
          .replace('<Override ', '<!-- <Override ')
          .replace('/></Types>', '/> --></Types>')
        return zip(entries)
      },
    ],
    [
      'broken XML',
      () => {
        const entries = officeEntries('docx')
        entries['[Content_Types].xml'] = entries['[Content_Types].xml'].replace(
          '<Override ',
          '<Override invalid <Override ',
        )
        return zip(entries)
      },
    ],
    [
      'missing main part',
      () => zip({ '[Content_Types].xml': officeEntries('docx')['[Content_Types].xml'] }),
    ],
    ['truncated directory', () => zip(officeEntries('docx')).subarray(0, -12)],
    [
      'directory outside file',
      () => {
        const b = zip(officeEntries('docx'))
        b.writeUInt32LE(0xffffff00, b.length - 6)
        return b
      },
    ],
    [
      'local offset outside file',
      () => {
        const b = zip(officeEntries('docx'))
        const central = b.readUInt32LE(b.length - 6)
        b.writeUInt32LE(0xffffff00, central + 42)
        return b
      },
    ],
    ['path traversal', () => zip({ ...officeEntries('docx'), '../evil': 'x' })],
    [
      'oversized content types',
      () => zip({ ...officeEntries('docx'), '[Content_Types].xml': 'x'.repeat(1_048_577) }, true),
    ],
    [
      'too many entries',
      () => zip(Object.fromEntries(Array.from({ length: 4097 }, (_, i) => [`entry${i}`, '']))),
    ],
    [
      'invalid compressed data',
      () => {
        const b = zip(officeEntries('docx'), true)
        b.fill(
          0,
          30 + Buffer.byteLength('[Content_Types].xml'),
          45 + Buffer.byteLength('[Content_Types].xml'),
        )
        return b
      },
    ],
  ] as const)('rejects %s with a public 400 error', (_, fixture) => {
    expect(() => validateOfficeArchive(fixture(), 'docx')).toThrow(
      'File is not a valid Word document.',
    )
    try {
      validateOfficeArchive(fixture(), 'docx')
    } catch (error) {
      expect(error).toMatchObject({ status: 400 })
    }
  })
  describe('content-types namespaces', () => {
    const namespace = 'http://schemas.openxmlformats.org/package/2006/content-types'
    const validateXML = (xml: string) => {
      const entries = officeEntries('docx')
      entries['[Content_Types].xml'] = xml
      validateOfficeArchive(zip(entries), 'docx')
    }
    const xml = officeEntries('docx')['[Content_Types].xml']
    it.each([
      [
        'foreign default child namespace',
        xml.replace('<Override ', '<Override xmlns="urn:not-opc" '),
      ],
      ['empty default child namespace', xml.replace('<Override ', '<Override xmlns="" ')],
      [
        'rebound root prefix',
        xml
          .replace('<Types xmlns=', '<opc:Types xmlns:opc=')
          .replace('</Types>', '</opc:Types>')
          .replace('<Override ', '<opc:Override xmlns:opc="urn:not-opc" '),
      ],
      ['undeclared child prefix', xml.replace('<Override ', '<unknown:Override ')],
      ['reserved XML prefix rebinding', xml.replace('<Types ', '<Types xmlns:xml="urn:not-xml" ')],
      ['reserved xmlns prefix', xml.replace('<Types ', '<Types xmlns:xmlns="urn:not-opc" ')],
      ['empty prefixed declaration', xml.replace('<Types ', '<Types xmlns:ct="" ')],
      [
        'malformed namespace prefix',
        xml.replace('<Types ', `<Types xmlns:ct:other="${namespace}" `),
      ],
      ['malformed qualified name', xml.replace('<Override ', '<opc:other:Override ')],
    ])('rejects %s', (_, fixture) => {
      expect(() => validateXML(fixture)).toThrow('File is not a valid Word document.')
    })
    it.each([
      [
        'child-declared equivalent prefix',
        xml.replace('<Override ', `<ct:Override xmlns:ct="${namespace}" `),
      ],
      [
        'inherited equivalent prefix',
        xml
          .replace('<Types ', `<Types xmlns:ct="${namespace}" `)
          .replace('<Override ', '<ct:Override '),
      ],
      [
        'different root and child prefixes',
        xml
          .replace('<Types xmlns=', '<opc:Types xmlns:opc=')
          .replace('</Types>', '</opc:Types>')
          .replace('<Override ', `<ct:Override xmlns:ct="${namespace}" `),
      ],
      [
        'default namespace under prefixed root',
        xml
          .replace('<Types xmlns=', '<opc:Types xmlns:opc=')
          .replace('</Types>', '</opc:Types>')
          .replace('<Override ', `<Override xmlns="${namespace}" `),
      ],
      [
        'paired child with equivalent prefix',
        xml
          .replace('<Override ', `<ct:Override xmlns:ct="${namespace}" `)
          .replace('/></Types>', '></ct:Override></Types>'),
      ],
      [
        'self-closing child scope restored',
        xml.replace(
          '<Override ',
          `<ct:Default xmlns="urn:foreign" xmlns:ct="${namespace}" Extension="xml" ContentType="application/xml"/><Override `,
        ),
      ],
      [
        'paired child scope restored',
        xml.replace(
          '<Override ',
          `<ct:Default xmlns="urn:foreign" xmlns:ct="${namespace}" Extension="xml" ContentType="application/xml"></ct:Default><Override `,
        ),
      ],
    ])('accepts %s', (_, fixture) => {
      expect(() => validateXML(fixture)).not.toThrow()
    })
  })
  it.each(['word/vbaProject.bin', 'WORD/VBAPROJECT.BIN', 'vbaProject.bin'])(
    'rejects macro entry %s',
    (name) => {
      expect(() =>
        validateOfficeArchive(zip({ ...officeEntries('docx'), [name]: 'macro' }), 'docx'),
      ).toThrow(
        'Documents with macros are not allowed. Save the file as .docx without macros and upload again.',
      )
    },
  )
  it('rejects entity-encoded macroEnabled content types', () => {
    const entries = officeEntries('docx')
    entries['[Content_Types].xml'] = entries['[Content_Types].xml'].replace(
      '</Types>',
      '<Default Extension="bin" ContentType="application/macro&#69;nabled"/></Types>',
    )
    expect(() => validateOfficeArchive(zip(entries), 'docx')).toThrow(
      'Documents with macros are not allowed.',
    )
  })
  it('rejects macroEnabled content types', () => {
    const entries = officeEntries('xlsx')
    entries['[Content_Types].xml'] = entries['[Content_Types].xml'].replace(
      'spreadsheetml.sheet.main',
      'spreadsheetml.sheet.macroEnabled.main',
    )
    expect(() => validateOfficeArchive(zip(entries), 'xlsx')).toThrow(
      'Documents with macros are not allowed. Save the file as .xlsx without macros and upload again.',
    )
  })
})
