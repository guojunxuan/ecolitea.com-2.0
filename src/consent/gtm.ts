export const validGtmId = (value: string | undefined): string | null =>
  value && /^GTM-[A-Z0-9]+$/.test(value) ? value : null

// Called from the client provider; Next inlines this public value at build time.
export const getGtmId = (): string | null =>
  validGtmId(process.env.NEXT_PUBLIC_GTM_MEASUREMENT_ID)
