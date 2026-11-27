import type { TranslationRule } from './index'

// Media metadata belongs to the upload/storage adapters and stays provider-neutral.
// Populated media relationships are merged explicitly at the Phase 3 read boundary.
export const mediaRule: TranslationRule = {
  alt: 'translate',
  caption: 'translate',
  prefix: 'exclude',
  url: 'exclude',
  thumbnailURL: 'exclude',
  filename: 'exclude',
  mimeType: 'exclude',
  width: 'exclude',
  height: 'exclude',
  filesize: 'exclude',
  focalX: 'exclude',
  focalY: 'exclude',
  durationSeconds: 'exclude',
  // Payload 4 upload storage metadata (hidden, read-only, owned by the upload adapter).
  _objectKey: 'exclude',
  'original.filename': 'exclude',
  'original.url': 'exclude',
  'original.mimeType': 'exclude',
  'original.prefix': 'exclude',
  'original._objectKey': 'exclude',
}
