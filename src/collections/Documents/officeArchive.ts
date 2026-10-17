import { crc32, inflateRawSync } from 'node:zlib'
import { APIError } from 'payload'

const mainParts = {
  docx: {
    name: 'word/document.xml',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',
    label: 'Word',
  },
  xlsx: {
    name: 'xl/workbook.xml',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml',
    label: 'Excel',
  },
  pptx: {
    name: 'ppt/presentation.xml',
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml',
    label: 'PowerPoint',
  },
} as const

// Only the content-types entry is inflated. All directory and local entry offsets
// are checked first; limits also reject ZIP64, multi-disk and oversized archives.
const MAX_DIRECTORY_BYTES = 1_048_576
const MAX_CONTENT_TYPES_BYTES = 1_048_576
const MAX_ENTRIES = 4096
const MAX_EXPANDED_BYTES = 100_000_000

type Entry = {
  checksum: number
  compressed: number
  size: number
  method: number
  start: number
  end: number
}

type ContentType = { part?: string; type: string }

// Content_Types has a deliberately small XML vocabulary. Parse that vocabulary
// rather than matching text inside comments or accepting malformed markup.
function readContentTypes(source: string, invalid: () => never): ContentType[] {
  const xml = source.replace(/^\uFEFF/, '').replace(/^<\?xml\s+[^?]*\?>/, '')
  const types: ContentType[] = []
  const stack: string[] = []
  const parts = new Set<string>()
  let rootName = ''
  let rootPrefix = ''
  let closed = false
  let cursor = 0
  const decode = (value: string) =>
    value.replace(/&([^;]*);|&/g, (entity, name: string | undefined) => {
      const predefined: Record<string, string> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      }
      if (name && Object.hasOwn(predefined, name)) return predefined[name]
      if (name && /^#(?:[0-9]+|x[0-9a-f]+)$/i.test(name)) {
        const code =
          name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
        if (code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff))
          return String.fromCodePoint(code)
      }
      return invalid()
    })
  while (cursor < xml.length) {
    const whitespace = /^\s+/.exec(xml.slice(cursor))
    if (whitespace) {
      cursor += whitespace[0].length
      continue
    }
    if (xml.startsWith('<!--', cursor)) {
      const end = xml.indexOf('-->', cursor + 4)
      if (end < 0 || xml.slice(cursor + 4, end).includes('--')) invalid()
      cursor = end + 3
      continue
    }
    const closing = /^<\/([A-Za-z_][\w:.-]*)\s*>/.exec(xml.slice(cursor))
    if (closing) {
      if (!stack.length || stack.pop() !== closing[1]) invalid()
      if (!stack.length) closed = true
      cursor += closing[0].length
      continue
    }
    const opening = /^<([A-Za-z_][\w:.-]*)/.exec(xml.slice(cursor))
    if (!opening || closed || stack.length > 1) return invalid()
    const name = opening[1]
    cursor += opening[0].length
    const attributes: Record<string, string> = {}
    while (!xml.startsWith('>', cursor) && !xml.startsWith('/>', cursor)) {
      const attribute = /^\s+([A-Za-z_][\w:.-]*)\s*=\s*(["'])([^<]*?)\2/.exec(xml.slice(cursor))
      if (!attribute) {
        const trailing = /^\s+(?=\/?>)/.exec(xml.slice(cursor))
        if (trailing) {
          cursor += trailing[0].length
          break
        }
        return invalid()
      }
      if (Object.hasOwn(attributes, attribute[1])) invalid()
      attributes[attribute[1]] = decode(attribute[3])
      cursor += attribute[0].length
    }
    const selfClosing = xml.startsWith('/>', cursor)
    cursor += selfClosing ? 2 : 1
    if (!stack.length) {
      if (rootName || selfClosing || !/^(?:[A-Za-z_][\w.-]*:)?Types$/.test(name)) invalid()
      rootName = name
      rootPrefix = name.includes(':') ? name.split(':')[0] + ':' : ''
      const namespace = rootPrefix ? `xmlns:${rootPrefix.slice(0, -1)}` : 'xmlns'
      if (attributes[namespace] !== 'http://schemas.openxmlformats.org/package/2006/content-types')
        invalid()
    } else {
      if (
        stack[0] !== rootName ||
        ![`${rootPrefix}Override`, `${rootPrefix}Default`].includes(name)
      )
        invalid()
      if (!attributes.ContentType) invalid()
      if (name === `${rootPrefix}Override`) {
        if (!attributes.PartName || parts.has(attributes.PartName)) invalid()
        parts.add(attributes.PartName)
        types.push({ part: attributes.PartName, type: attributes.ContentType })
      } else {
        if (!attributes.Extension) invalid()
        types.push({ type: attributes.ContentType })
      }
    }
    if (!selfClosing) stack.push(name)
  }
  if (!closed || stack.length) invalid()
  return types
}

export function validateOfficeArchive(bytes: Buffer, extension: keyof typeof mainParts): void {
  const main = mainParts[extension]
  const invalid = () => {
    throw new APIError(`File is not a valid ${main.label} document.`, 400)
  }
  const macros = () => {
    throw new APIError(
      `Documents with macros are not allowed. Save the file as .${extension} without macros and upload again.`,
      400,
    )
  }
  try {
    if (bytes.length > 10_000_000 || bytes.length < 22) invalid()
    let end = -1
    for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
      if (
        bytes.readUInt32LE(offset) === 0x06054b50 &&
        offset + 22 + bytes.readUInt16LE(offset + 20) === bytes.length
      ) {
        end = offset
        break
      }
    }
    if (end < 0) return invalid()
    const count = bytes.readUInt16LE(end + 10)
    const directorySize = bytes.readUInt32LE(end + 12)
    const directoryStart = bytes.readUInt32LE(end + 16)
    if (
      bytes.readUInt16LE(end + 4) !== 0 ||
      bytes.readUInt16LE(end + 6) !== 0 ||
      bytes.readUInt16LE(end + 8) !== count ||
      count < 1 ||
      count > MAX_ENTRIES ||
      directorySize > MAX_DIRECTORY_BYTES ||
      directoryStart + directorySize !== end
    )
      invalid()

    const entries = new Map<string, Entry>()
    const ranges: [number, number][] = []
    let expanded = 0
    let cursor = directoryStart
    let hasMacros = false
    for (let index = 0; index < count; index++) {
      if (cursor + 46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) invalid()
      const flags = bytes.readUInt16LE(cursor + 8)
      const method = bytes.readUInt16LE(cursor + 10)
      const checksum = bytes.readUInt32LE(cursor + 16)
      const compressed = bytes.readUInt32LE(cursor + 20)
      const size = bytes.readUInt32LE(cursor + 24)
      const nameLength = bytes.readUInt16LE(cursor + 28)
      const extraLength = bytes.readUInt16LE(cursor + 30)
      const commentLength = bytes.readUInt16LE(cursor + 32)
      const local = bytes.readUInt32LE(cursor + 42)
      const next = cursor + 46 + nameLength + extraLength + commentLength
      if (
        next > end ||
        !nameLength ||
        bytes.readUInt16LE(cursor + 34) !== 0 ||
        (flags & 0x41) !== 0 ||
        ![0, 8].includes(method)
      )
        invalid()
      const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength)
      const name = nameBytes.toString('utf8')
      if (
        name.includes('\0') ||
        name.includes('\\') ||
        name.startsWith('/') ||
        /^[a-z]:/i.test(name) ||
        name.split('/').some((part) => part === '..' || part === '.') ||
        entries.has(name)
      )
        invalid()
      if (/(?:^|\/)vbaproject\.bin$/i.test(name)) hasMacros = true
      expanded += size
      if (
        expanded > MAX_EXPANDED_BYTES ||
        size === 0xffffffff ||
        compressed === 0xffffffff ||
        local + 30 > directoryStart
      )
        invalid()
      if (
        bytes.readUInt32LE(local) !== 0x04034b50 ||
        bytes.readUInt16LE(local + 6) !== flags ||
        bytes.readUInt16LE(local + 8) !== method
      )
        invalid()
      const localNameLength = bytes.readUInt16LE(local + 26)
      const localExtraLength = bytes.readUInt16LE(local + 28)
      const start = local + 30 + localNameLength + localExtraLength
      const stop = start + compressed
      if (
        start > directoryStart ||
        stop > directoryStart ||
        !bytes.subarray(local + 30, local + 30 + localNameLength).equals(nameBytes)
      )
        invalid()
      if (
        !(flags & 8) &&
        (bytes.readUInt32LE(local + 14) !== checksum ||
          bytes.readUInt32LE(local + 18) !== compressed ||
          bytes.readUInt32LE(local + 22) !== size)
      )
        invalid()
      if (method === 0 && compressed !== size) invalid()
      entries.set(name, { checksum, compressed, size, method, start, end: stop })
      ranges.push([local, stop])
      cursor = next
    }
    if (cursor !== end) invalid()
    ranges.sort((a, b) => a[0] - b[0])
    for (let index = 1; index < ranges.length; index++)
      if (ranges[index][0] < ranges[index - 1][1]) invalid()
    if (hasMacros) macros()
    const contentTypes = entries.get('[Content_Types].xml')
    if (!contentTypes || contentTypes.size > MAX_CONTENT_TYPES_BYTES) return invalid()
    const compressed = bytes.subarray(contentTypes.start, contentTypes.end)
    const xmlBytes =
      contentTypes.method === 0
        ? compressed
        : inflateRawSync(compressed, { maxOutputLength: MAX_CONTENT_TYPES_BYTES })
    if (xmlBytes.length !== contentTypes.size || crc32(xmlBytes) !== contentTypes.checksum)
      invalid()
    const types = readContentTypes(xmlBytes.toString('utf8'), invalid)
    if (types.some(({ type }) => /macroEnabled/i.test(type))) macros()
    if (
      types.filter(({ part, type }) => part === `/${main.name}` && type === main.type).length !==
        1 ||
      !entries.get(main.name)?.size
    )
      invalid()
  } catch (error) {
    if (error instanceof APIError) throw error
    invalid()
  }
}
