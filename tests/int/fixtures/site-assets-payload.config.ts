import path from 'node:path'
import { fileURLToPath } from 'node:url'

import appConfig from '../../../src/payload.config'

const config = await appConfig
const migrationDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'site-assets-migrations')
const initializeDatabaseAdapter = config.db.init
config.db.init = (args) => {
  const adapter = initializeDatabaseAdapter(args)
  adapter.migrationDir = migrationDir
  return adapter
}

export default config
