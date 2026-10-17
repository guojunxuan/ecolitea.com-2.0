import type { Endpoint } from 'payload'
import { findMediaReferences } from '../mediaReferences'

export const mediaReferencesEndpoint: Endpoint = {
  path: '/:id/references',
  method: 'get',
  handler: async (req) => {
    const headers = { 'Cache-Control': 'private, no-store' }
    if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
    const id = req.routeParams?.id
    if ((typeof id !== 'string' && typeof id !== 'number') || !String(id)) {
      return Response.json({ error: 'Media ID is required.' }, { status: 400, headers })
    }
    const references = await findMediaReferences(req.payload, [id], req)
    return Response.json(
      {
        current: references.filter(({ kind }) => kind === 'current'),
        historicalCount: references.filter(({ kind }) => kind === 'version').length,
      },
      { headers },
    )
  },
}
