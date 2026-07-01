/**
 * Cron: проверка «молчащих» учеников — нет активности 3+ дня.
 * Шлёт пуш ТОЛЬКО КУРАТОРУ ученика (по curator_id) в Telegram + пишет в
 * notifications_log (лента куратора в веб-панели). Админам/супер-админам НЕ шлёт.
 * Идемпотентно: одно уведомление на «эпизод тишины» (ключ — дата последней
 * активности) через curator_notify_state. Раз в день (vercel.json).
 *
 * Защита: Authorization: Bearer ${CRON_SECRET} (Vercel добавляет автоматически).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-service'
import { sendTelegramMessage, escapeHtml } from '@/lib/telegram/send'
import { findSilentStudents, SILENCE_DAYS } from '@/lib/activity/silence'
import { sendCuratorDigests } from '@/lib/curator/daily-digest'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Дневная сводка куратору (в этом же cron-слоте: лимит Vercel — 2 крона).
  const digests = await sendCuratorDigests(supabase).catch((e) => {
    console.error('[cron/silence-check] digests', e)
    return 0
  })

  const silent = await findSilentStudents(supabase, { minDays: SILENCE_DAYS })
  if (silent.length === 0) return NextResponse.json({ ok: true, silent: 0, sent: 0, digests })

  // Telegram-чаты кураторов (по одному запросу).
  const curatorIds = [...new Set(silent.map((s) => s.curatorId))]
  const { data: curatorsRaw } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .in('id', curatorIds)
  const chatByCurator = new Map<string, number>()
  for (const c of (curatorsRaw ?? []) as Array<{ id: string; telegram_chat_id: number | string | null }>) {
    if (c.telegram_chat_id != null && Number.isFinite(Number(c.telegram_chat_id))) {
      chatByCurator.set(c.id, Number(c.telegram_chat_id))
    }
  }

  let sent = 0
  for (const s of silent) {
    // Идемпотентность: один алерт на эпизод тишины (ключ — дата последней активности).
    const eventKey = s.lastActiveAt ? s.lastActiveAt.slice(0, 10) : 'never'
    const { error: dupErr } = await supabase
      .from('curator_notify_state')
      .insert({ student_id: s.id, event_type: 'student_silent', event_key: eventKey })
    if (dupErr) continue // UNIQUE → уже уведомляли за этот эпизод

    // В ленту куратора (веб-панель). notification_type из CHECK: 'silence_3days'.
    await supabase.from('notifications_log').insert({
      curator_id: s.curatorId,
      student_id: s.id,
      notification_type: 'silence_3days',
    })

    // Пуш куратору в бот.
    const chatId = chatByCurator.get(s.curatorId)
    if (!chatId) continue
    const ok = await sendTelegramMessage(
      chatId,
      `🔕 <b>${escapeHtml(s.name)}</b> не заходит ${s.daysSilent} дн. — напомни ему 🙏`,
    )
    if (ok) sent++
  }

  return NextResponse.json({ ok: true, silent: silent.length, sent })
}
