import type { MigrateDownArgs, MigrateUpArgs, MongooseAdapter } from '@payloadcms/db-mongodb'

type ObjectRecord = Record<string, unknown>
type Move = { from: string; to: string }

const asRecord = (value: unknown): ObjectRecord | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as ObjectRecord)
    : undefined

const getPath = (value: ObjectRecord, path: string): unknown =>
  path.split('.').reduce<unknown>((current, key) => asRecord(current)?.[key], value)

const moves: Move[] = [
  { from: 'blog.listing.hero', to: 'blog.hero' },
  { from: 'blog.listing.seo', to: 'blog.seo' },
  { from: 'blog.article.share', to: 'blog.share' },
]

export function planBlogSettingsMove(
  document: ObjectRecord,
  direction: 'up' | 'down',
): { set: ObjectRecord; unset: ObjectRecord } {
  const set: ObjectRecord = {}
  const unset: ObjectRecord = {}
  for (const move of moves) {
    const from = direction === 'up' ? move.from : move.to
    const to = direction === 'up' ? move.to : move.from
    const value = getPath(document, from)
    if (value === undefined) continue
    if (getPath(document, to) !== undefined) {
      throw new Error(`Blog settings migration collision: ${to} already exists.`)
    }
    set[to] = value
    unset[from] = ''
  }

  if (direction === 'up') {
    const blog = asRecord(document.blog)
    for (const [group, ownedKeys] of [
      ['listing', ['hero', 'seo']],
      ['article', ['share']],
    ] as const) {
      const value = asRecord(blog?.[group])
      if (value && Object.keys(value).every((key) => ownedKeys.includes(key as never))) {
        for (const key of ownedKeys) delete unset[`blog.${group}.${key}`]
        unset[`blog.${group}`] = ''
      }
    }
  }

  return { set, unset }
}

async function migrate({ payload }: MigrateUpArgs | MigrateDownArgs, direction: 'up' | 'down') {
  const adapter = payload.db as MongooseAdapter
  const db = adapter.connection.db
  if (!db) throw new Error('Blog settings migration requires an open MongoDB connection.')
  payload.logger.info({
    msg: `Blog settings migration (${direction}) target: ${adapter.connection.host}:${adapter.connection.port}/${db.databaseName}; storage: unchanged`,
  })

  const globals = db.collection('globals')
  const document = await globals.findOne({ globalType: 'settings' })
  if (!document) return
  const { set, unset } = planBlogSettingsMove(document, direction)
  if (Object.keys(set).length === 0 && Object.keys(unset).length === 0) return
  const update: ObjectRecord = {}
  if (Object.keys(set).length) update.$set = set
  if (Object.keys(unset).length) update.$unset = unset
  await globals.updateOne({ _id: document._id, globalType: 'settings' }, update)
}

export async function up(args: MigrateUpArgs): Promise<void> {
  await migrate(args, 'up')
}

export async function down(args: MigrateDownArgs): Promise<void> {
  await migrate(args, 'down')
}
