import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'

/**
 * DELETE /api/super-admin/whitelist/[username]
 * Remove a username from whitelist
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  const auth = await requireSuperAdmin()
  if ('errorResponse' in auth) return auth.errorResponse

  const { supabase } = auth.superAdmin
  const { username } = await params

  try {
    const { error, data } = await supabase
      .from('testing_whitelist')
      .delete()
      .eq('telegram_username', username)
      .select('telegram_username')

    if (error) {
      console.error('[super-admin/whitelist/[username] DELETE]', error)
      return NextResponse.json(
        { error: { code: 'DELETE_ERROR', message: 'Failed to remove from whitelist' } },
        { status: 500 }
      )
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Username not in whitelist' } },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[super-admin/whitelist/[username] DELETE]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
