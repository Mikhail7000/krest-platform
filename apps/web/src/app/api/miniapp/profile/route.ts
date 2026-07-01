import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/miniapp/profile
 *
 * Возвращает профиль текущего пользователя для проверки онбординга.
 *
 * Body: { initData }
 * Ответ: { onboarding_done, country_id, city_id, curator_id, full_name }
 *
 * Аутентификация — через Telegram initData + resolveUserId (как весь /m/*).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { initData?: string }

    const auth = await resolveUserId(body.initData ?? '')
    if (!auth.ok) {
      return NextResponse.json(
        { error: { code: auth.code, message: auth.message } },
        { status: auth.status }
      )
    }

    const supabase = createServiceSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('onboarding_done, role, country_id, city_id, curator_id, full_name, avatar_path, gender, theme_pref')
      .eq('id', auth.userId)
      .maybeSingle()

    if (profileError) {
      console.error('[profile POST] query error:', profileError)
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Failed to fetch profile' } },
        { status: 500 }
      )
    }

    if (!profile) {
      return NextResponse.json(
        { error: { code: 'PROFILE_NOT_FOUND', message: 'Profile not found' } },
        { status: 404 }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const avatar_url = profile.avatar_path
      ? `${supabaseUrl}/storage/v1/object/public/avatars/${profile.avatar_path}`
      : null

    return NextResponse.json({
      onboarding_done: profile.onboarding_done,
      role: profile.role ?? 'student',
      country_id: profile.country_id,
      city_id: profile.city_id,
      curator_id: profile.curator_id,
      full_name: profile.full_name,
      avatar_url,
      gender: profile.gender ?? null,
      theme_pref: profile.theme_pref ?? null,
    })
  } catch (err) {
    console.error('[profile POST]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
