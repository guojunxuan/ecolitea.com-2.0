import type { LogoImage } from './types'

export const selectLogo = (
  primary: LogoImage | null,
  inverse: LogoImage | null,
  useInverse: boolean,
): LogoImage | null => (useInverse ? (inverse ?? primary) : primary)
