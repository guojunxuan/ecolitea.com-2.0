import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const readWorkflow = (name) =>
  readFileSync(fileURLToPath(new URL(`../../.github/workflows/${name}`, import.meta.url)), 'utf8')

const checksEnvironment = (workflow) => workflow.match(/    env:\n([\s\S]*?)\n    steps:/)?.[1] ?? ''

test('CI checks use isolated server and R2 environment values', () => {
  const environment = checksEnvironment(readWorkflow('ci.yml'))

  assert.match(environment, /NEXT_PUBLIC_SERVER_URL: http:\/\/localhost:3000/)
  assert.match(environment, /CRON_SECRET: ci-only-cron-secret/)
  assert.match(environment, /PREVIEW_SECRET: ci-only-preview-secret/)
  assert.match(environment, /R2_PUBLIC_URL: https:\/\/media\.example\.invalid/)
  assert.doesNotMatch(environment, /R2_PUBLIC_URL: \$\{\{ vars\.R2_PUBLIC_URL \}\}/)
})

test('release checks use isolated server and R2 environment values', () => {
  const workflow = readWorkflow('release.yml')
  const environment = checksEnvironment(workflow)

  assert.match(environment, /NEXT_PUBLIC_SERVER_URL: http:\/\/localhost:3000/)
  assert.match(environment, /CRON_SECRET: ci-only-cron-secret/)
  assert.match(environment, /PREVIEW_SECRET: ci-only-preview-secret/)
  assert.match(environment, /R2_PUBLIC_URL: https:\/\/media\.example\.invalid/)
  assert.doesNotMatch(environment, /R2_PUBLIC_URL: \$\{\{ vars\.R2_PUBLIC_URL \}\}/)
  assert.match(workflow, /build-args:[\s\S]*R2_PUBLIC_URL=\$\{\{ vars\.R2_PUBLIC_URL \}\}/)
})
