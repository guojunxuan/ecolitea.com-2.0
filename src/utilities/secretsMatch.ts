import { timingSafeEqual } from 'node:crypto'

/** Constant-time comparison for shared secrets; false when either side is missing. */
export function secretsMatch(supplied: string | null | undefined, expected: string | undefined) {
  if (!supplied || !expected) return false
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
