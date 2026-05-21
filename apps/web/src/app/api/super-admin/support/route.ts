import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'

/**
 * GET /api/super-admin/support
 *
 * Get list of support requests (super_admin only).
 *
 * Query params:
 *  - status: 'new' | 'read' | 'resolved' (optional, filter)
 *  - limit: 1-100 (default 50)
 *  - offset: default 0 (pagination)
 */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ('errorResponse' in auth) return auth.errorResponse

  const { supabase } = auth.superAdmin

  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') as 'new' | 'read' | 'resolved' | null
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '50'), 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabase as any).from('support_requests').select('*', { count: 'exact' })

    if (status) {
      query = query.eq('status', status)
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[super-admin/support GET]', error)
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch requests' } },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data,
      pagination: {
        offset,
        limit,
        total: count ?? 0,
      },
    })
  } catch (err) {
    console.error('[super-admin/support GET]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
