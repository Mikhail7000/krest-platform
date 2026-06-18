/**
 * Cron: ежедневные напоминания ученикам, не заходившим в приложение.
 * Расписание (vercel.json), время Бали (Asia/Makassar, UTC+8):
 *   ?stage=18 → 18:00 Бали (10:00 UTC) — мягкое напоминание
 *   ?stage=21 → 21:00 Бали (13:00 UTC) — только если так и не зашёл
 *
 * Защита: Authorization: Bearer ${CRON_SECRET} (Vercel добавляет автоматически).
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-service'
import { sendTelegramMessage } from '@/lib/telegram/send'
import { baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

// 18:00 — мягкое, мотивирующее «не забудь зайти»
const POOL_18 = [
  'Верность и постоянство — ключ к успеху. Загляни в КРЕСТ сегодня 🙏',
  'Не хлебом единым жив человек (Мф. 4:4). Удели время КРЕСТу сегодня.',
  'Кто верен в малом, верен и в большом (Лк. 16:10). Зайди в КРЕСТ ✝️',
  'Маленький шаг каждый день рождает большую веру. Открой КРЕСТ.',
  'Ты ещё не заходил сегодня. Один шаг в КРЕСТ — и день прожит не зря.',
]

// 21:00 — сильнее, вызов: «день начинается с вечера»
const POOL_21 = [
  'День начинается с вечера. Ты так и не зашёл сегодня — успей ✝️',
  'Сдай курс Креста. Но путь проходят каждый день — начни сейчас.',
  'Не живи двойной жизнью. Будь верен пути — загляни в КРЕСТ.',
  'Ещё не поздно. Открой КРЕСТ хотя бы на пару минут 🙏',
  'Постоянство решает. Не пропусти день — он начинается с вечера.',
]

function pick(pool: string[]): string {
  return pool[Math.floor(Math.random() * pool.length)]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  const stage = req.nextUrl.searchParams.get('stage')
  if (stage !== '18' && stage !== '21') {
    return NextResponse.json({ error: 'stage must be 18 or 21' }, { status: 400 })
  }

  const supabase = createServiceSupabase()
  const today = baliToday()
  const pool = stage === '18' ? POOL_18 : POOL_21

  // Ученики с привязанным Telegram
  const { data: students, error: stErr } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id')
    .eq('role', 'student')
    .not('telegram_chat_id', 'is', null)

  if (stErr) {
    console.error('[daily-reminder] students error:', stErr)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  // Активность за сегодня
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actRaw } = await (supabase as any)
    .from('student_daily_activity')
    .select('user_id, opened, reminded_18, reminded_21')
    .eq('activity_date', today)

  type Act = { user_id: string; opened: boolean; reminded_18: boolean; reminded_21: boolean }
  const actMap = new Map<string, Act>()
  for (const a of (actRaw ?? []) as Act[]) actMap.set(a.user_id, a)

  let sent = 0
  const nowIso = new Date().toISOString()

  for (const s of students ?? []) {
    const chatId = s.telegram_chat_id
    if (!chatId) continue
    const act = actMap.get(s.id)
    if (act?.opened) continue // уже заходил сегодня
    if (stage === '18' ? act?.reminded_18 : act?.reminded_21) continue // уже напомнили

    const ok = await sendTelegramMessage(chatId, `✝️ <b>КРЕСТ</b>\n\n${pick(pool)}`, {
      withMiniAppButton: true,
    })
    if (!ok) continue
    sent++

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('student_daily_activity').upsert(
      {
        user_id: s.id,
        activity_date: today,
        ...(stage === '18' ? { reminded_18: true } : { reminded_21: true }),
        updated_at: nowIso,
      },
      { onConflict: 'user_id,activity_date' },
    )

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('notifications_log').insert({
      user_id: s.id,
      channel: 'telegram',
      type: `daily_reminder_${stage}`,
      status: 'sent',
    })
  }

  return NextResponse.json({ ok: true, stage, date: today, candidates: students?.length ?? 0, sent })
}
