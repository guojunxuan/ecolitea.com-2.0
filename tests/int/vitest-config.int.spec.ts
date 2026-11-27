// @vitest-environment node

import { describe, expect, it } from 'vitest'

describe('integration test configuration', () => {
  it('collects both TypeScript and TSX integration specs', async () => {
    const configURL = new URL('../../vitest.config.mts', import.meta.url).href
    const { default: vitestConfig } = await import(configURL)

    expect(vitestConfig).toMatchObject({
      test: { include: ['tests/int/**/*.int.spec.{ts,tsx}'] },
    })
  })
})
