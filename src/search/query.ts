export const normalizeSearchQuery = (query: string | string[] | undefined): string =>
  (Array.isArray(query) ? query[0] : query) ?? ''
