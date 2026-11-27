import { crc32, deflateRawSync } from 'node:zlib'

export const officeTypes = {
  docx: {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    part: 'word/document.xml',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    label: 'Word',
  },
  xlsx: {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    part: 'xl/workbook.xml',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    label: 'Excel',
  },
  pptx: {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    part: 'ppt/presentation.xml',
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
    label: 'PowerPoint',
  },
} as const

export function zip(entries: Record<string, string | Buffer>, deflate = false): Buffer {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const [name, value] of Object.entries(entries)) {
    const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value)
    const compressed = deflate ? deflateRawSync(bytes) : bytes
    const filename = Buffer.from(name)
    const header = Buffer.alloc(30)
    header.writeUInt32LE(0x04034b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(deflate ? 8 : 0, 8)
    header.writeUInt32LE(crc32(bytes), 14)
    header.writeUInt32LE(compressed.length, 18)
    header.writeUInt32LE(bytes.length, 22)
    header.writeUInt16LE(filename.length, 26)
    const directory = Buffer.alloc(46)
    directory.writeUInt32LE(0x02014b50, 0)
    directory.writeUInt16LE(20, 4)
    directory.writeUInt16LE(20, 6)
    directory.writeUInt16LE(deflate ? 8 : 0, 10)
    directory.writeUInt32LE(crc32(bytes), 16)
    directory.writeUInt32LE(compressed.length, 20)
    directory.writeUInt32LE(bytes.length, 24)
    directory.writeUInt16LE(filename.length, 28)
    directory.writeUInt32LE(offset, 42)
    local.push(header, filename, compressed)
    central.push(directory, filename)
    offset += header.length + filename.length + compressed.length
  }
  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(central.length / 2, 8)
  end.writeUInt16LE(central.length / 2, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, directory, end])
}

export function officeEntries(extension: keyof typeof officeTypes) {
  const type = officeTypes[extension]
  return {
    '[Content_Types].xml': `<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/${type.part}" ContentType="${type.type}"/></Types>`,
    [type.part]: '<document/>',
  }
}
export const validPDF = Buffer.from(
  '%PDF-1.7\n1 0 obj\n<<>>\nendobj\nxref\n0 1\n0000000000 65535 f\ntrailer\n<<>>\nstartxref\n0\n%%EOF',
)
