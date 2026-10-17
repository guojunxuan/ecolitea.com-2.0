import { ValidationError, type CollectionBeforeValidateHook } from 'payload'

export const validateMediaAlt: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const changed = data && Object.hasOwn(data, 'alt') && data.alt !== originalDoc?.alt
  if (operation !== 'create' && !req.file && !changed) return data

  const value = data && Object.hasOwn(data, 'alt') ? data.alt : originalDoc?.alt
  const alt = (typeof value === 'string' ? value : '').trim()
  let message: string | undefined
  if (!alt) message = 'Alt text is required.'
  else if (
    /\.(?:jpe?g|png|webp|avif|gif|mp4|svg|pdf)\b/i.test(alt) ||
    /^(?:img[_ -]?\d+|dsc[_ -]?\d+|screenshot[ _-]*\d.*|截屏\s*\d.*|\d+[\d\s:./_-]*)$/i.test(alt)
  ) {
    message = 'Alt text should describe the image, not repeat the filename.'
  } else if (/^(?:image|photo|picture|video)\d*$/i.test(alt)) {
    message = 'Alt text is too generic. Describe what is shown.'
  } else if (Array.from(alt).length < 5 || Array.from(alt).length > 125) {
    message = 'Alt text should be 5–125 characters.'
  }
  if (message)
    throw new ValidationError({ collection: 'media', errors: [{ path: 'alt', message }] })
  return { ...data, alt }
}
