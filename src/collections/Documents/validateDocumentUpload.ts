import { open, stat } from 'node:fs/promises'
import path from 'node:path'
import {
  APIError,
  type CollectionBeforeOperationHook,
  type CollectionBeforeValidateHook,
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

const checkUpload = async (file: UploadFile, generatedFilesize?: unknown) => {
  const type = Object.entries(DOCUMENT_UPLOAD_POLICY.types).find(
    ([, value]) => value.mimeType === file.mimetype,
  )
  if (!type)
    throw new APIError(
      `Unsupported file type: ${file.mimetype || 'unknown'}. Documents accepts PDF, Word (.docx), Excel (.xlsx) and PowerPoint (.pptx).`,
      400,
    )
  const sizes = [file.size, file.data?.byteLength, generatedFilesize]
  if (file.tempFilePath) sizes.push((await stat(file.tempFilePath)).size)
  if (sizes.some((size) => typeof size === 'number' && size > DOCUMENT_UPLOAD_POLICY.maxBytes))
    throw new APIError('File size exceeds the maximum of 10 MB.', 400)
  const extension = path.extname(file.name).slice(1).toLowerCase()
  if (extension !== type[0])
    throw new APIError(`File extension ".${extension}" does not match its type (.${type[0]}).`, 400)
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
    if (length > DOCUMENT_UPLOAD_POLICY.maxBytes)
      throw new APIError('File size exceeds the maximum of 10 MB.', 400)
    return bytes.subarray(0, length)
  } finally {
    await handle.close()
  }
}

const validateNewFile = async (file: UploadFile, generatedFilesize?: unknown) => {
  const extension = await checkUpload(file, generatedFilesize)
  // Payload checkFileRestrictions owns PDF structure validation.
  if (extension !== 'pdf') validateOfficeArchive(await readOfficeBytes(file), extension)
}

// Native upload processing precedes beforeValidate. This public earlier hook
// preserves the declared MIME/size/extension error order for real uploads.
export const validateDocumentUploadEarly: CollectionBeforeOperationHook = async ({
  operation,
  req,
}) => {
  if ((operation === 'create' || operation === 'update') && req.file) {
    await validateNewFile(req.file)
  }
}

export const validateDocumentUpload: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!req.file) return data
  await validateNewFile(req.file, data?.filesize)
  return data
}
