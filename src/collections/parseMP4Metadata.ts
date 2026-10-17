import { open } from 'node:fs/promises'
import { createFile } from 'mp4box'

export type ParsedMP4Metadata = {
  durationSeconds: number
  videoCodecs: string[]
  audioCodecs: string[]
  width: number
  height: number
}

type MP4Info = {
  duration: number
  timescale: number
  videoTracks: Array<{
    codec: string
    video?: { width: number; height: number }
    track_width?: number
    track_height?: number
    matrix?: ArrayLike<number>
  }>
  audioTracks: Array<{ codec: string }>
}
type MP4BoxBuffer = ArrayBuffer & { fileStart?: number }
type MP4BoxFile = {
  onReady?: (info: MP4Info) => void
  onError?: (module: string, message: string) => void
  appendBuffer: (buffer: MP4BoxBuffer) => unknown
  flush: () => void
}
type Input = Buffer | { tempFilePath: string }
const CHUNK_SIZE = 1024 * 1024
const faststartError =
  'Video is not optimized for web streaming (moov atom at end of file). Re-export with "Fast Start" / "Web Optimized" enabled, or run: ffmpeg -i in.mp4 -c copy -movflags +faststart out.mp4'

export const parseMP4MetadataWithFactory = async (
  input: Input,
  createMP4File: () => MP4BoxFile,
): Promise<ParsedMP4Metadata> => {
  const handle = Buffer.isBuffer(input) ? undefined : await open(input.tempFilePath, 'r')
  try {
    const size = Buffer.isBuffer(input) ? input.length : (await handle!.stat()).size
    const read = async (start: number, length: number) => {
      if (Buffer.isBuffer(input)) return input.subarray(start, start + length)
      const buffer = Buffer.alloc(length)
      const { bytesRead } = await handle!.read(buffer, 0, length, start)
      if (bytesRead !== length) throw new Error('MP4 file is truncated.')
      return buffer
    }
    // Walk top-level headers without loading mdat. Size validation also protects
    // the chunk loop from malformed or overflowing atom lengths.
    let end = 0
    let foundMoov = false
    while (end < size) {
      if (size - end < 8) throw new Error('MP4 atom header is truncated.')
      let header = await read(end, 8)
      let length = header.readUInt32BE(0)
      const type = header.toString('ascii', 4, 8)
      let headerSize = 8
      if (length === 1) {
        if (size - end < 16) throw new Error('MP4 extended atom header is truncated.')
        header = await read(end, 16)
        const extended = header.readBigUInt64BE(8)
        if (extended > BigInt(Number.MAX_SAFE_INTEGER))
          throw new Error('MP4 atom length is invalid.')
        length = Number(extended)
        headerSize = 16
      } else if (length === 0) length = size - end
      if (length < headerSize || length > size - end)
        throw new Error('MP4 atom length is invalid or truncated.')
      if (type === 'mdat') throw new Error(faststartError)
      end += length
      if (type === 'moov') {
        foundMoov = true
        break
      }
    }
    if (!foundMoov) throw new Error('MP4 metadata could not be read.')

    const file = createMP4File()
    let result: ParsedMP4Metadata | undefined
    let error: Error | undefined
    file.onReady = (info) => {
      const durationSeconds = info.duration / info.timescale
      if (
        !Number.isFinite(info.timescale) ||
        info.timescale <= 0 ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0
      ) {
        error = new Error('MP4 duration metadata could not be read.')
        return
      }
      const track = info.videoTracks?.[0]
      if (!track) {
        error = new Error('MP4 file does not contain a video track.')
        return
      }
      const width = track.video?.width ?? track.track_width ?? 0
      const height = track.video?.height ?? track.track_height ?? 0
      if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
        error = new Error('MP4 video dimensions could not be read.')
        return
      }
      // MP4's 16.16 fixed-point track matrix determines display orientation.
      const matrix = track.matrix
      const rotated =
        matrix &&
        Math.abs(matrix[1]) > Math.abs(matrix[0]) &&
        Math.abs(matrix[3]) > Math.abs(matrix[4])
      result = {
        durationSeconds,
        width: rotated ? height : width,
        height: rotated ? width : height,
        videoCodecs: info.videoTracks.map(({ codec }) => codec.toLowerCase()),
        audioCodecs: (info.audioTracks ?? []).map(({ codec }) => codec.toLowerCase()),
      }
    }
    file.onError = (_module, message) => {
      error = new Error(`MP4 parser error: ${message}`)
    }
    for (let position = 0; position < end; position += CHUNK_SIZE) {
      const chunk = await read(position, Math.min(CHUNK_SIZE, end - position))
      const buffer = Object.assign(
        chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.length),
        { fileStart: position },
      ) as MP4BoxBuffer
      file.appendBuffer(buffer)
      if (error) throw error
      if (result) break
    }
    if (!result) file.flush()
    if (error) throw error
    if (!result) throw new Error('MP4 metadata could not be read.')
    return result
  } finally {
    await handle?.close()
  }
}

export const parseMP4Metadata = (input: Input) =>
  parseMP4MetadataWithFactory(input, () => createFile() as unknown as MP4BoxFile)
