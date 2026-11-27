import type { FieldHook } from 'payload'

export const trimText: FieldHook = ({ value }) => (typeof value === 'string' ? value.trim() : value)

export const validateNonBlankText = (value?: unknown): string | true =>
  typeof value === 'string' && value.trim().length > 0
    ? true
    : 'Enter a value that is not only whitespace.'

const isHTTPURL = (value: string): boolean => {
  if (/\s/.test(value)) return false

  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname)
  } catch {
    return false
  }
}

const mailbox = "[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*"
const hostname = '[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*'
const mailtoPattern = new RegExp(`^mailto:${mailbox}@${hostname}$`, 'i')

export const validateNavigationURL = (value?: unknown): string | true => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return 'Enter a custom URL.'
  }

  const url = value.trim()
  const isSupported =
    isHTTPURL(url) ||
    /^\/(?!\/)[^\s]*$/.test(url) ||
    /^#[^\s]+$/.test(url) ||
    mailtoPattern.test(url) ||
    /^tel:\+?[0-9().\-\s]*[0-9][0-9().\-\s]*$/i.test(url)

  return isSupported ? true : 'Use http(s), a root-relative path, an anchor, mailto, or tel URL.'
}
