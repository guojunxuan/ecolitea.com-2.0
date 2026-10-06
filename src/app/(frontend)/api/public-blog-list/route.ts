import {
  getPublicBlogResults,
  InvalidPublicBlogFilters,
  parsePublicBlogFilters,
} from '@/utilities/blogs/getPublicBlogResults'

export const dynamic = 'force-dynamic'
export const revalidate = 0
const headers = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  try {
    const filters = parsePublicBlogFilters(new URL(request.url).searchParams)
    return Response.json(await getPublicBlogResults(filters), { headers })
  } catch (error) {
    if (error instanceof InvalidPublicBlogFilters) {
      return Response.json({ error: error.message }, { status: 400, headers })
    }
    console.error('Failed to fetch public blog list', error)
    return Response.json({ error: 'Failed to fetch blogs' }, { status: 500, headers })
  }
}
