/** Stable presentation key; URL parameter encoding belongs to the frontend. */
export const optionKey = (value: string): string =>
  value
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}]+/gu)
    ?.join('-') ?? ''
