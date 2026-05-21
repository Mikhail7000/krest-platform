import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'

/**
 * PATCH /api/super-admin/support/[id]
 *
 * Update status of a support request (super_admin only).
 *
 * Body: { status: 'new' | 'read' | 'resolved' }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperAdmin()
  if ('errorResponse' in auth) return auth.errorResponse

  const { supabase } = auth.superAdmin
  const { id } = await params

  try {
    const { status } = (await request.json()) as { status: string }

    if (!['new', 'read', 'resolved'].includes(status)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid status' } },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('support_requests')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      console.error('[super-admin/support/[id] PATCH]', error)
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to update request' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[super-admin/support/[id] PATCH]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
