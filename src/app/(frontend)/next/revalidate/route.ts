import { timingSafeEqual } from 'node:crypto'
import { revalidatePath, revalidateTag } from 'next/cache'
import { serverEnv } from '@/utilities/env'
import { REVALIDATION_LIMIT } from '@/plugins/translation/revalidate'

export async function POST(request: Request): Promise<Response> {
  const secret = serverEnv.REVALIDATE_SECRET
  if (!secret) return new Response(null, { status: 503 })
  const expected = Buffer.from(`Bearer ${secret}`)
  const supplied = Buffer.from(request.headers.get('authorization') ?? '')
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return new Response(null, { status: 401 })
  }
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return new Response(null, { status: 400 })
  const { tags, paths } = body as { tags?: unknown; paths?: unknown }
  const strings = (value: unknown, maxLength: number): value is string[] | undefined =>
    value === undefined ||
    (Array.isArray(value) &&
      value.every(
        (item) => typeof item === 'string' && item.length > 0 && item.length <= maxLength,
      ))
  if (
    !strings(tags, 256) ||
    !strings(paths, 1024) ||
    (tags?.length ?? 0) + (paths?.length ?? 0) > REVALIDATION_LIMIT ||
    paths?.some((path) => !path.startsWith('/') || path.startsWith('//'))
  ) {
    return new Response(null, { status: 400 })
  }
  for (const tag of new Set(tags)) revalidateTag(tag, { expire: 0 })
  for (const path of new Set(paths)) {
    if (path.includes('[')) revalidatePath(path, 'page')
    else revalidatePath(path)
  }
  return new Response(null, { status: 204 })
}
