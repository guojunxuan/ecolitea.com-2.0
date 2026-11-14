import { copyFileSync, cpSync, readdirSync } from 'node:fs'
import path from 'node:path'

const buildDirectory = path.resolve('.next')
const standaloneDirectory = path.join(buildDirectory, 'standalone', '.next')

// generate-env changes chunk references after compile has copied standalone.
// Static assets are copied separately by Docker; only refresh its runtime files here.
cpSync(path.join(buildDirectory, 'server'), path.join(standaloneDirectory, 'server'), {
  recursive: true,
})

for (const entry of readdirSync(buildDirectory, { withFileTypes: true })) {
  if (entry.isFile() && /\.(?:js|json|js\.map)$/.test(entry.name)) {
    copyFileSync(path.join(buildDirectory, entry.name), path.join(standaloneDirectory, entry.name))
  }
}
