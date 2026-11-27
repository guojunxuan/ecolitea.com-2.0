import { open, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  APIError,
  type CollectionBeforeOperationHook,
  type CollectionBeforeValidateHook,
  type PayloadRequest,
} from 'payload'
import { DOCUMENT_UPLOAD_POLICY } from './uploadPolicy'
import { validateOfficeArchive } from './officeArchive'

type UploadFile = {
  data: Buffer
  mimetype: string
  name: string
  size: number
  tempFilePath?: string
}

const sizeError = (bytes: number) =>
  new APIError(
    `File is too large (${Math.round(bytes / 1_000_000)} MB). Maximum is ${DOCUMENT_UPLOAD_POLICY.maxBytes / 1_000_000} MB.`,
    400,
  )

const checkUpload = async (file: UploadFile, generatedFilesize?: unknown) => {
  const type = Object.entries(DOCUMENT_UPLOAD_POLICY.types).find(
    ([, value]) => value.mimeType === file.mimetype,
  )
  if (!type)
    throw new APIError(
      'Unsupported file type. Use PDF, Word (.docx), Excel (.xlsx) or PowerPoint (.pptx).',
      400,
    )
  const sizes = [file.size, file.data?.byteLength, generatedFilesize]
  if (file.tempFilePath) sizes.push((await stat(file.tempFilePath)).size)
  const observedSize = Math.max(
    ...sizes.filter((size): size is number => typeof size === 'number' && !Number.isNaN(size)),
  )
  if (observedSize > DOCUMENT_UPLOAD_POLICY.maxBytes) throw sizeError(observedSize)
  const extension = path.extname(file.name).slice(1).toLowerCase()
  if (extension !== type[0])
    throw new APIError(
      `File extension doesn't match its content. Save it again as .${type[0]}.`,
      400,
    )
  return type[0] as keyof typeof DOCUMENT_UPLOAD_POLICY.types
}

const readOfficeBytes = async (file: UploadFile): Promise<Buffer> => {
  if (!file.tempFilePath || file.data?.length) return file.data
  const handle = await open(file.tempFilePath, 'r')
  try {
    // A temporary file growing after stat must not cause an unbounded allocation.
    const bytes = Buffer.alloc(DOCUMENT_UPLOAD_POLICY.maxBytes + 1)
    let length = 0
    while (length < bytes.length) {
      const result = await handle.read(bytes, length, bytes.length - length, length)
      if (!result.bytesRead) break
      length += result.bytesRead
    }
    if (length > DOCUMENT_UPLOAD_POLICY.maxBytes) throw sizeError(length)
    return bytes.subarray(0, length)
  } finally {
    await handle.close()
  }
}

const validateNewFile = async (
  file: UploadFile,
  req: PayloadRequest,
  generatedFilesize?: unknown,
) => {
  const logError = (err: unknown) =>
    req.payload?.logger?.error({ err, msg: 'Document upload could not be read.' })
  try {
    const extension = await checkUpload(file, generatedFilesize)
    // Payload checkFileRestrictions owns PDF structure validation.
    if (extension !== 'pdf') validateOfficeArchive(await readOfficeBytes(file), extension, logError)
  } catch (error) {
    if (error instanceof APIError) throw error
    logError(error)
    const type = Object.values(DOCUMENT_UPLOAD_POLICY.types).find(
      (type) => type.mimeType === file.mimetype,
    )
    throw new APIError(
      `This ${type?.label ?? 'document'} file can't be read. Try saving it again.`,
      400,
    )
  }
}

// Native upload processing precedes beforeValidate. This public earlier hook
// preserves the declared MIME/size/extension error order for real uploads.
export const validateDocumentUploadEarly: CollectionBeforeOperationHook = async ({
  operation,
  req,
}) => {
  if ((operation === 'create' || operation === 'update') && req.file) {
    await validateNewFile(req.file, req)
  }
}

export const validateDocumentUpload: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!req.file) return data
  await validateNewFile(req.file, req, data?.filesize)
  return data
}
