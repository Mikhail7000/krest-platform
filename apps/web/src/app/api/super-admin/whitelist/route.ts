import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/super-admin-auth'

/**
 * GET /api/super-admin/whitelist
 * List all whitelisted Telegram usernames
 *
 * POST /api/super-admin/whitelist
 * Add a new username to whitelist
 *
 * Body: { telegram_username: string, display_name?: string }
 */

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ('errorResponse' in auth) return auth.errorResponse

  const { supabase } = auth.superAdmin

  try {
    const searchParams = request.nextUrl.searchParams
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '100'), 1), 100)
    const offset = Math.max(parseInt(searchParams.get('offset') ?? '0'), 0)

    const { data, error, count } = await supabase
      .from('testing_whitelist')
      .select('telegram_username, display_name, added_at, updated_at', { count: 'exact' })
      .order('added_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[super-admin/whitelist GET]', error)
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch whitelist' } },
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
    console.error('[super-admin/whitelist GET]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if ('errorResponse' in auth) return auth.errorResponse

  const { supabase } = auth.superAdmin

  try {
    const { telegram_username, display_name } = (await request.json()) as {
      telegram_username: string
      display_name?: string
    }

    // Validate username format (must start with @)
    if (!telegram_username || !telegram_username.startsWith('@')) {
      return NextResponse.json(
        {
          error: {
            code: 'BAD_REQUEST',
            message: 'Username must start with @',
          },
        },
        { status: 400 }
      )
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from('testing_whitelist')
      .select('telegram_username')
      .eq('telegram_username', telegram_username)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        {
          error: {
            code: 'ALREADY_EXISTS',
            message: 'Username already in whitelist',
          },
        },
        { status: 409 }
      )
    }

    // Insert
    const { error } = await supabase.from('testing_whitelist').insert({
      telegram_username,
      display_name: display_name || telegram_username,
      added_by: auth.superAdmin.userId,
      added_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      console.error('[super-admin/whitelist POST]', error)
      return NextResponse.json(
        { error: { code: 'INSERT_ERROR', message: 'Failed to add to whitelist' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (err) {
    console.error('[super-admin/whitelist POST]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
