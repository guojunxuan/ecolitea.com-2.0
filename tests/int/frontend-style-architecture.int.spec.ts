import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8')

describe('frontend style architecture', () => {
  it('keeps frontend and Payload global styles isolated', () => {
    expect(read('src/app/(frontend)/layout.tsx')).toContain("import './globals.css'")
    expect(read('src/app/(payload)/layout.tsx')).toContain("import './custom.css'")
    expect(read('src/app/(payload)/layout.tsx')).not.toContain('frontend/globals.css')
  })

  it('keeps the existing route groups as separate root layouts', () => {
    const frontend = read('src/app/(frontend)/layout.tsx')
    const payload = read('src/app/(payload)/layout.tsx')

    expect(frontend).toContain('<html')
    expect(frontend).toContain('<body')
    expect(payload).toContain('@payloadcms/next/layouts')
  })
})
