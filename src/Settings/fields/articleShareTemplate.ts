/** A starting point for editors; platform-specific URLs remain editable. */
export const generateArticleShareURL = (name: string): string => {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (!normalized) return ''
  if (normalized === 'email') return 'mailto:?subject={title}&body={url}'
  return `https://www.${normalized}.com/share?url={url}&title={title}`
}
