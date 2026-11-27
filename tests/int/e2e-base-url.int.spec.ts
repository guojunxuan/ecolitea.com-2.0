import { describe, expect, it } from 'vitest'

import { getE2EBaseURL } from '../helpers/e2eBaseURL'

describe('getE2EBaseURL', () => {
  it('uses the isolated Playwright origin when configured', () => {
    expect(getE2EBaseURL('http://127.0.0.1:3001')).toBe('http://127.0.0.1:3001')
  })

  it('keeps localhost:3000 as the standalone default', () => {
    expect(getE2EBaseURL(undefined)).toBe('http://localhost:3000')
  })
})
