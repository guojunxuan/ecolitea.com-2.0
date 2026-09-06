// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  assertDedicatedE2EDatabaseURI,
  assertRunScopedE2EDatabaseURI,
  createRunScopedE2EDatabaseURI,
} from '../helpers/e2eDatabase'

describe('Playwright database isolation', () => {
  it('unconditionally rejects the developer database URI, including an -e2e database', () => {
    const developerURI = 'mongodb://127.0.0.1/developer-e2e'
    expect(() => assertDedicatedE2EDatabaseURI(developerURI, developerURI)).toThrow(
      'must not match the developer DATABASE_URI',
    )
  })

  it('rejects databases without the dedicated -e2e suffix', () => {
    expect(() => assertDedicatedE2EDatabaseURI('mongodb://127.0.0.1/ecolitea2')).toThrow(
      'ending in "-e2e"',
    )
  })

  it('creates and verifies a distinct database for each run', () => {
    const first = createRunScopedE2EDatabaseURI('mongodb://127.0.0.1/ecolitea2-e2e', 'run-one')
    const second = createRunScopedE2EDatabaseURI('mongodb://127.0.0.1/ecolitea2-e2e', 'run-two')
    expect(first).toContain('/ecolitea2-run-one-e2e')
    expect(second).toContain('/ecolitea2-run-two-e2e')
    expect(first).not.toBe(second)
    expect(() => assertRunScopedE2EDatabaseURI(first, 'run-one')).not.toThrow()
    expect(() => assertRunScopedE2EDatabaseURI(first, 'run-two')).toThrow(
      'outside the current run-scoped E2E database',
    )
  })
})
