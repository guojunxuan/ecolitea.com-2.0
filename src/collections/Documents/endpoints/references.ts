import type { Endpoint } from 'payload'
import { findDocumentReferences } from '../references'

export const documentReferencesEndpoint: Endpoint = {
  path: '/:id/references',
  method: 'get',
  handler: async (req) => {
    const headers = { 'Cache-Control': 'private, no-store' }
    if (!req.user) return Response.json({ error: 'Unauthorized' }, { status: 401, headers })
    const id = req.routeParams?.id
    if ((typeof id !== 'string' && typeof id !== 'number') || !String(id)) {
      return Response.json({ error: 'Document ID is required.' }, { status: 400, headers })
    }
    const references = await findDocumentReferences(req.payload, [id], req)
    return Response.json(
      {
        current: references.filter(({ kind }) => kind === 'current'),
        historicalCount: new Set(
          references
            .filter(({ kind }) => kind === 'version')
            .map(({ ownerType, ownerSlug, versionID }) =>
              JSON.stringify([ownerType, ownerSlug, versionID]),
            ),
        ).size,
      },
      { headers },
    )
  },
}
