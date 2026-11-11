// Preserve the actual installed Next Image exports across the standalone bundler's CJS boundary.
import image from 'next/image.js'
export default image.default
export const getImageProps = image.getImageProps
