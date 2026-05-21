import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/**
 * GET /api/miniapp/profile
 *
 * Возвращает профиль текущего пользователя для проверки онбординга и других данных.
 *
 * Ответ: { onboarding_done, country_id, city_id, curator_id, full_name }
 */
export async function GET() {
  try {
    const supabase = await createServerSupabase()
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError || !userData.user) {
      return NextResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    const userId = userData.user.id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile, error: profileError } = await (supabase as any)
      .from('profiles')
      .select('onboarding_done, country_id, city_id, curator_id, full_name')
      .eq('id', userId)
      .maybeSingle()

    if (profileError) {
      console.error('[profile GET] query error:', profileError)
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

    return NextResponse.json({
      onboarding_done: profile.onboarding_done,
      country_id: profile.country_id,
      city_id: profile.city_id,
      curator_id: profile.curator_id,
      full_name: profile.full_name,
    })
  } catch (err) {
    console.error('[profile GET]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
