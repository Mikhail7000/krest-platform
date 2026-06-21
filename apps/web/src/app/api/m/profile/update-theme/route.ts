import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

const ALLOWED_THEMES = new Set(['light', 'dark', 'stars', 'pink'])
const ALLOWED_GENDERS = new Set(['male', 'female'])

/**
 * POST /api/m/profile/update-theme
 *
 * Обновляет явный выбор темы и/или пол ученика (только для оформления).
 *
 * Body: { initData, theme_pref?: 'light'|'dark'|'stars'|'pink'|null, gender?: 'male'|'female'|null }
 * Ответ: { ok: true }
 *
 * Аутентификация — через Telegram initData (как весь /m/*).
 * Пишет ТОЛЬКО в строку звонящего (auth.userId) — нет IDOR.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      theme_pref?: string | null
      gender?: string | null
    }

    // Валидация theme_pref
    if (body.theme_pref !== undefined && body.theme_pref !== null) {
      if (!ALLOWED_THEMES.has(body.theme_pref)) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Недопустимое значение theme_pref' } },
          { status: 400 }
        )
      }
    }

    // Валидация gender
    if (body.gender !== undefined && body.gender !== null) {
      if (!ALLOWED_GENDERS.has(body.gender)) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Недопустимое значение gender' } },
          { status: 400 }
        )
      }
    }

    // Нечего обновлять
    if (body.theme_pref === undefined && body.gender === undefined) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Не переданы поля для обновления' } },
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

    // Формируем только те поля, которые переданы
    const updateFields: Record<string, string | null> = {}
    if (body.theme_pref !== undefined) updateFields.theme_pref = body.theme_pref ?? null
    if (body.gender !== undefined) updateFields.gender = body.gender ?? null

    const supabase = createServiceSupabase()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update(updateFields)
      .eq('id', auth.userId)

    if (updateError) {
      console.error('[update-theme] profile update error:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Не удалось сохранить настройки' } },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[update-theme POST]', err)
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } },
      { status: 500 }
    )
  }
}
