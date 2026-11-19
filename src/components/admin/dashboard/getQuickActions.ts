import type { PayloadRequest, SanitizedPermissions } from 'payload'

const actions = [
  { collection: 'products', label: 'New product' },
  { collection: 'blogs', label: 'New blog' },
  { collection: 'media', label: 'Upload media' },
] as const

export function getQuickActions(req: PayloadRequest, permissions: SanitizedPermissions) {
  return actions
    .filter(({ collection }) => permissions.collections?.[collection]?.create)
    .map(({ collection, label }) => ({
      label,
      href: `${req.payload.config.routes.admin}/collections/${collection}/create`,
    }))
}
