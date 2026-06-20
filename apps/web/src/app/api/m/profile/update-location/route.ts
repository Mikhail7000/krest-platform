import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

/**
 * POST /api/m/profile/update-location
 *
 * Ученик меняет страну и город через профиль (настройки).
 *
 * Body: { initData, country_id, city_id }
 * Валидация: город существует, принадлежит выбранной стране и активен (status='active').
 *
 * Аутентификация — через Telegram initData + resolveUserId (как весь /m/*).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      country_id?: number | string
      city_id?: number | string
    }

    const countryId = Number(body.country_id)
    const cityId = Number(body.city_id)

    if (!Number.isInteger(countryId) || !Number.isInteger(cityId) || countryId <= 0 || cityId <= 0) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Некорректные страна или город' } },
        { status: 400 }
      )
    }

    const auth = await resolveUserId(body.initData ?? '')
    if (!auth.ok) {
      return NextResponse.json(
        { error: { code: auth.code, message: auth.message } },
        { status: auth.status }
      )
    }

    const supabase = createServiceSupabase()

    // Валидация: город принадлежит стране и активен
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: city, error: cityError } = await (supabase as any)
      .from('cities')
      .select('id, country_id, status')
      .eq('id', cityId)
      .maybeSingle()

    if (cityError) {
      console.error('[update-location] city query error:', cityError)
      return NextResponse.json(
        { error: { code: 'QUERY_ERROR', message: 'Не удалось проверить город' } },
        { status: 500 }
      )
    }

    if (!city) {
      return NextResponse.json(
        { error: { code: 'CITY_NOT_FOUND', message: 'Город не найден' } },
        { status: 400 }
      )
    }

    if (city.country_id !== countryId) {
      return NextResponse.json(
        { error: { code: 'CITY_COUNTRY_MISMATCH', message: 'Город не относится к выбранной стране' } },
        { status: 400 }
      )
    }

    if (city.status !== 'active') {
      return NextResponse.json(
        { error: { code: 'CITY_INACTIVE', message: 'Этот город пока недоступен' } },
        { status: 400 }
      )
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update({ country_id: countryId, city_id: cityId })
      .eq('id', auth.userId)

    if (updateError) {
      console.error('[update-location] profile update error:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Не удалось сохранить локацию' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[update-location POST]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
