import { createFile } from 'mp4box'

export type ParsedMP4Metadata = {
  durationSeconds: number
  videoCodecs: string[]
  audioCodecs: string[]
}

type MP4Info = {
  duration: number
  timescale: number
  videoTracks: Array<{ codec: string }>
  audioTracks: Array<{ codec: string }>
}

type MP4BoxBuffer = ArrayBuffer & { fileStart?: number }

type MP4BoxFile = {
  onReady?: (info: MP4Info) => void
  onError?: (module: string, message: string) => void
  appendBuffer: (buffer: MP4BoxBuffer) => void
  flush: () => void
}

export const parseMP4MetadataWithFactory = (
  buffer: Buffer,
  createMP4File: () => MP4BoxFile,
): Promise<ParsedMP4Metadata> =>
  new Promise((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (!settled) {
        settled = true
        callback()
      }
    }
    const file = createMP4File()

    file.onReady = (info) => {
      if (
        !Number.isFinite(info.duration) ||
        !Number.isFinite(info.timescale) ||
        info.timescale <= 0
      ) {
        finish(() => reject(new Error('MP4 duration metadata could not be read.')))
        return
      }

      const durationSeconds = info.duration / info.timescale
      if (!Number.isFinite(durationSeconds) || durationSeconds < 0) {
        finish(() => reject(new Error('MP4 duration metadata could not be read.')))
        return
      }

      if (!Array.isArray(info.videoTracks) || info.videoTracks.length === 0) {
        finish(() => reject(new Error('MP4 file does not contain a video track.')))
        return
      }

      finish(() =>
        resolve({
          durationSeconds,
          videoCodecs: info.videoTracks.map(({ codec }) => codec.toLowerCase()),
          audioCodecs: info.audioTracks.map(({ codec }) => codec.toLowerCase()),
        }),
      )
    }
    file.onError = (_module, message) =>
      finish(() => reject(new Error(`MP4 parser error: ${message}`)))

    try {
      const mp4boxBuffer = Object.assign(
        buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
        { fileStart: 0 },
      ) as MP4BoxBuffer
      file.appendBuffer(mp4boxBuffer)
      file.flush()
      if (!settled) {
        finish(() => reject(new Error('MP4 metadata could not be read.')))
      }
    } catch (error) {
      finish(() => reject(error))
    }
  })

export const parseMP4Metadata = (buffer: Buffer) =>
  parseMP4MetadataWithFactory(buffer, () => createFile() as unknown as MP4BoxFile)
