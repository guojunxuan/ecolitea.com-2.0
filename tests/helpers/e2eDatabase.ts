const databaseName = (uri: string): string | null =>
  new URL(uri).pathname.replace(/^\//, '').split('/').at(-1) ?? null

export function assertDedicatedE2EDatabaseURI(candidate: string, developerURI?: string): void {
  if (developerURI && candidate === developerURI) {
    throw new Error('E2E_DATABASE_URI must not match the developer DATABASE_URI.')
  }

  if (!databaseName(candidate)?.endsWith('-e2e')) {
    throw new Error('E2E_DATABASE_URI must name a dedicated database ending in "-e2e".')
  }
}

export function createRunScopedE2EDatabaseURI(baseURI: string, runID: string): string {
  assertDedicatedE2EDatabaseURI(baseURI)
  const safeRunID = runID.replace(/[^a-zA-Z0-9-]/g, '')
  if (!safeRunID) throw new Error('The E2E run ID must contain an alphanumeric character.')

  const url = new URL(baseURI)
  const baseName = databaseName(baseURI)!
  const scopedName = `${baseName.slice(0, -'-e2e'.length)}-${safeRunID}-e2e`
  url.pathname = `/${scopedName}`
  return url.toString()
}

export function assertRunScopedE2EDatabaseURI(uri: string, runID: string): void {
  assertDedicatedE2EDatabaseURI(uri)
  if (!databaseName(uri)?.includes(`-${runID}-e2e`)) {
    throw new Error('Refusing cleanup outside the current run-scoped E2E database.')
  }
}
