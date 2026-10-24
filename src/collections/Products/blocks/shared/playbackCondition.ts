import type { Field } from 'payload'

export const videoPlaybackCondition = (_data: unknown, siblingData: Record<string, unknown>) => {
  const mediaDoc = siblingData?.media
  return (
    typeof mediaDoc === 'object' &&
    mediaDoc !== null &&
    'mimeType' in mediaDoc &&
    typeof mediaDoc.mimeType === 'string' &&
    mediaDoc.mimeType.startsWith('video/')
  )
}

export const playbackField: Field = {
  name: 'playback',
  label: 'Playback',
  type: 'select',
  options: [
    { label: 'Ambient', value: 'ambient' },
    { label: 'Player', value: 'player' },
  ],
  defaultValue: 'ambient',
  admin: { condition: videoPlaybackCondition },
}
