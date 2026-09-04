import { expect, test } from '@playwright/test'

test('does not expose the template demo seed endpoint', async ({ request }) => {
  const response = await request.get('http://localhost:3000/next/seed')

  expect(response.status()).toBe(404)
})
