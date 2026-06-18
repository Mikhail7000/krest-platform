import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { sendTelegramMessage } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * POST /api/miniapp/onboarding
 *
 * Завершение онбординга: сохранение выбора страны, города, куратора, имени, языка.
 *
 * Body: { initData, country_id, city_id, curator_id, full_name, lang }
 *
 * Аутентификация — через Telegram initData + resolveUserId (как весь /m/*).
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      initData?: string
      country_id?: number | string
      city_id?: number | string
      curator_id?: string | null
      full_name?: string
      lang?: 'ru' | 'en'
    }

    const { initData, country_id, city_id, curator_id, full_name, lang } = body

    // curator_id, full_name, lang необязательны (опциональные шаги)
    if (!country_id || !city_id) {
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
    const update: Record<string, unknown> = {
      country_id: Number(country_id),
      city_id: Number(city_id),
      onboarding_done: true,
      lang: lang ?? 'ru',
    }
    // curator_id обновляем только если явно передан — иначе оставляем текущее значение
    if (curator_id !== undefined && curator_id !== null) update.curator_id = curator_id
    // Имя обновляем только если передано — иначе оставляем уже сохранённое
    if (full_name) update.full_name = full_name

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from('profiles')
      .update(update)
      .eq('id', auth.userId)

    if (updateError) {
      console.error('[onboarding POST] profile update error:', updateError)
      return NextResponse.json(
        { error: { code: 'UPDATE_FAILED', message: 'Failed to save onboarding data' } },
        { status: 500 }
      )
    }

    // Якорь старта недельной разблокировки блоков. Ставим ОДИН раз
    // (.is null) — чтобы повторный онбординг не сбросил отсчёт и не залочил
    // уже продвинувшегося ученика. См. is_block_unlocked / course_started_at.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('profiles')
      .update({ course_started_at: new Date().toISOString() })
      .eq('id', auth.userId)
      .is('course_started_at', null)

    // Уведомление владельцу: ученик завершил регистрацию и попал на учёбу.
    // Только для role=student (кураторы при ре-онбординге не шлют).
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: prof } = await (supabase as any)
        .from('profiles')
        .select('role, full_name, contact_info')
        .eq('id', auth.userId)
        .maybeSingle()
      if (prof?.role === 'student') {
        const who = escapeHtml(prof.full_name || 'Ученик')
        const handle = prof.contact_info ? escapeHtml(prof.contact_info) : 'без username'
        const text =
          `🎓 <b>Новый ученик на учёбе</b>\n\n${who} (${handle}) завершил регистрацию и попал на курс.`
        const adminChatIds = (process.env.ADMIN_TELEGRAM_CHAT_IDS || '255214568')
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n))
        await Promise.all(adminChatIds.map((cid) => sendTelegramMessage(cid, text)))
      }
    } catch (e) {
      console.error('[onboarding notify]', e)
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
