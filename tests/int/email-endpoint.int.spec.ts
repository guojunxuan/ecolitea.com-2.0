// @vitest-environment node
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'
import { createTestEmailEndpoint } from '@/plugins/email/endpoint'

function request(role?: string, id = 'admin-one') {
  return {
    user: role ? { id, role, email: `${id}@example.test` } : null,
    payload: { sendEmail: vi.fn(async () => ({ status: 'sent' })) },
  } as unknown as PayloadRequest
}
describe('Admin test email endpoint', () => {
  it('rejects anonymous and editor requests server-side', async () => {
    const endpoint = createTestEmailEndpoint()
    for (const role of [undefined, 'editor']) {
      const req = request(role)
      expect((await endpoint.handler(req)).status).toBe(403)
      expect(req.payload.sendEmail).not.toHaveBeenCalled()
    }
  })
  it('sends only to the requesting administrator and rate-limits each user', async () => {
    let now = 1000
    const endpoint = createTestEmailEndpoint({ now: () => now })
    const req = request('admin')
    expect((await endpoint.handler(req)).status).toBe(200)
    expect(req.payload.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'admin-one@example.test' }),
    )
    expect((await endpoint.handler(req)).status).toBe(429)
    expect((await endpoint.handler(request('admin', 'admin-two'))).status).toBe(200)
    now += 30000
    expect((await endpoint.handler(req)).status).toBe(200)
  })
  it('reports skipped or failed delivery and hides unexpected exception details', async () => {
    for (const status of ['skipped', 'failed']) {
      const req = request('admin')
      vi.mocked(req.payload.sendEmail).mockResolvedValue({
        status,
        error: 'Email is not configured.',
      })
      const response = await createTestEmailEndpoint().handler(req)
      expect(response.status).toBe(503)
      expect(await response.json()).toMatchObject({ status, error: 'Email is not configured.' })
    }
    const req = request('admin')
    vi.mocked(req.payload.sendEmail).mockRejectedValue(new Error('secret transport text'))
    const response = await createTestEmailEndpoint().handler(req)
    expect(JSON.stringify(await response.json())).not.toContain('secret')
    expect(response.status).toBe(503)
  })
})
