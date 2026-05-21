import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/miniapp/onboarding
 *
 * Завершение онбординга: сохранение выбора страны, города, куратора, имени.
 *
 * Body: { initData, country_id, city_id, curator_id, full_name }
 *
 * Аутентификация — через Telegram initData + resolveUserId (как весь /m/*).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      country_id?: number | string
      city_id?: number | string
      curator_id?: string
      full_name?: string
    }

    const { initData, country_id, city_id, curator_id, full_name } = body

    if (!country_id || !city_id || !curator_id || !full_name) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Missing required fields' } },
        { status: 400 }
      )
    }

    const auth = await resolveUserId(initData ?? '')
    if (!auth.ok) {
      return NextResponse.json(
        { error: { code: auth.code, message: auth.message } },
        { status: auth.status }
      )
    }

    const supabase = createServiceSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({
        country_id: Number(country_id),
        city_id: Number(city_id),
        curator_id,
        full_name,
        onboarding_done: true,
      })
      .eq('id', auth.userId)

    if (updateError) {
      console.error('[onboarding POST] profile update error:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to save onboarding data' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[onboarding POST]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
