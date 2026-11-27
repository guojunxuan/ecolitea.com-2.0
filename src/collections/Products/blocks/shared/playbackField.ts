import type { Field } from 'payload'

export const playbackField: Field = {
  name: 'playback',
  label: 'Playback',
  type: 'select',
  options: [
    { label: 'Ambient', value: 'ambient' },
    { label: 'Player', value: 'player' },
  ],
  defaultValue: 'ambient',
  required: true,
  admin: {
    description:
      'Video only. Ambient plays muted on loop; Player shows controls. Ignored for images and GIFs.',
  },
}
