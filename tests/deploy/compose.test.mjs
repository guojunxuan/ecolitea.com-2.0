import { strict as assert } from 'node:assert'
import { execFileSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
const file = fileURLToPath(new URL('../../docker-compose.yml', import.meta.url))
test('production compose contracts', () => {
  const out = execFileSync('docker', ['compose', '--env-file', '.env.example', '-f', file, 'config'], { encoding: 'utf8' })
  assert.match(out, /image: mongo:7\.0/)
  assert.match(out, /host_ip: 127\.0\.0\.1[\s\S]*target: 3000[\s\S]*published: "3000"/)
  assert.match(out, /DATABASE_URI:/)
  assert.match(out, /service_healthy/)
  assert.match(out, /mongodb_data/)
  assert.doesNotMatch(out, /27017:/)
})
