import { expect, test } from '@playwright/test'

import { getE2EBaseURL } from '../helpers/e2eBaseURL'

test('does not expose the template demo seed endpoint', async ({ request }) => {
  const response = await request.get(`${getE2EBaseURL()}/next/seed`)

  expect(response.status()).toBe(404)
})
