export function createIsolatedTestDatabaseURI(
  databaseName: string,
  baseURI = process.env.DATABASE_URI ?? 'mongodb://127.0.0.1:27017/ecolitea2-test',
): string {
  const url = new URL(baseURI)
  if (url.protocol !== 'mongodb:' || !['127.0.0.1', 'localhost', '::1'].includes(url.hostname)) {
    throw new Error('Integration tests require a local MongoDB server.')
  }
  const baseName = url.pathname.slice(1)
  if (!/(?:^|[-_])(?:test|int|e2e|ci)(?:$|[-_])/.test(baseName)) {
    throw new Error('Integration tests require a dedicated test database URI.')
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(databaseName)) {
    throw new Error('Integration test database name contains invalid characters.')
  }
  url.pathname = `/${databaseName}`
  return url.toString()
}
