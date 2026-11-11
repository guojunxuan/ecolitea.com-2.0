import * as entry from 'next/image.js'
export default (entry.default as unknown as { default?: typeof entry.default }).default ?? entry.default
