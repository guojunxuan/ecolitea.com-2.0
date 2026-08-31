// @vitest-environment node

import { describe, expect, it } from 'vitest'

import vitestConfig from '../../vitest.config.mts'

describe('integration test configuration', () => {
  it('collects both TypeScript and TSX integration specs', () => {
    expect(vitestConfig).toMatchObject({
      test: { include: ['tests/int/**/*.int.spec.{ts,tsx}'] },
    })
  })
})
