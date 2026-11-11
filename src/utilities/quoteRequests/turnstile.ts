const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Fails closed: any missing input, HTTP error, timeout or network error returns false. */
export async function verifyTurnstileToken({
  token,
  secret,
  ip,
  fetchImpl = fetch,
}: {
  token: string
  secret: string | undefined
  ip?: string
  fetchImpl?: typeof fetch
}): Promise<boolean> {
  if (!token || !secret) return false
  try {
    const body = new URLSearchParams({ secret, response: token })
    if (ip) body.set('remoteip', ip)
    const response = await fetchImpl(SITEVERIFY_URL, {
      method: 'POST',
      body,
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return false
    const result = (await response.json()) as { success?: boolean }
    return result.success === true
  } catch {
    return false
  }
}
