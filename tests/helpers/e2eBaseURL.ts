/**
 * Resolves the origin used by Playwright's isolated web server.
 */
export const getE2EBaseURL = (baseURL = process.env.PLAYWRIGHT_BASE_URL): string =>
  baseURL ?? 'http://localhost:3000'
