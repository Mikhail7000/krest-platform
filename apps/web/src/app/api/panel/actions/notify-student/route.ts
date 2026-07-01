import { NextRequest, NextResponse } from 'next/server'
import { getPanelSessionFromReq } from '@/lib/admin/guard'
import { createServiceSupabase } from '@/lib/supabase-service'
import { resolvePanelScope, studentCardAllowed } from '@/lib/admin/scope'
import { sendTelegramMessage, escapeHtml } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

/**
 * POST /api/panel/actions/notify-student  { studentId }
 * «Напомнить в Telegram»: шлёт ученику тёплое напоминание от бота с кнопкой MiniApp.
 * Доступно куратору (свой ученик), лидеру (свой город), админам — scope как у
 * карточки (studentCardAllowed). Rate-limit: раз в день на ученика (любым, кто
 * первый) — через UNIQUE в curator_notify_state (event_type='manual_reminder').
 */
export async function POST(req: NextRequest) {
  const session = await getPanelSessionFromReq(req)
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Не авторизован' }, { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { studentId?: string }
  const studentId = body.studentId?.trim()
  if (!studentId) {
    return NextResponse.json({ ok: false, error: 'Не указан ученик' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  const { data: stu } = await supabase
    .from('profiles')
    .select('id, full_name, contact_info, telegram_chat_id, curator_id, city_id, hidden_from_tracking, role')
    .eq('id', studentId)
    .maybeSingle()
  if (!stu || stu.role !== 'student') {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }
  const scope = await resolvePanelScope(supabase, session)
  if (!(await studentCardAllowed(supabase, scope, stu))) {
    return NextResponse.json({ ok: false, error: 'Ученик не найден' }, { status: 404 })
  }

  const chatId =
    stu.telegram_chat_id != null && Number.isFinite(Number(stu.telegram_chat_id))
      ? Number(stu.telegram_chat_id)
      : null
  if (!chatId) {
    return NextResponse.json(
      { ok: false, error: 'У ученика нет привязанного Telegram' },
      { status: 400 },
    )
  }

  // Раз в день на ученика (UTC-дата достаточна для антиспама).
  const todayKey = new Date().toISOString().slice(0, 10)
  const { error: insErr } = await supabase
    .from('curator_notify_state')
    .insert({ student_id: studentId, event_type: 'manual_reminder', event_key: todayKey })
  if (insErr) {
    return NextResponse.json(
      { ok: false, error: 'Сегодня ученику уже напоминали' },
      { status: 429 },
    )
  }

  const name = stu.full_name || 'друг'
  await sendTelegramMessage(
    chatId,
    `👋 <b>${escapeHtml(name)}</b>, тебя не хватает в КРЕСТ!\n\nЗагляни в приложение и закрой день — 4 небольшие практики, и серия продолжится. Наставник рядом и ждёт 🙏`,
    { withMiniAppButton: true },
  )
  await supabase.from('notifications_log').insert({
    user_id: studentId,
    channel: 'telegram',
    type: 'manual_reminder',
    status: 'sent',
  })

  return NextResponse.json({ ok: true })
}
