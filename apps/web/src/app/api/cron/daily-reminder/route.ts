/**
 * Cron: вечернее напоминание ученикам — 20:00 ПО ЧАСОВОМУ ПОЯСУ УЧЕНИКА.
 * Запускается ЕЖЕЧАСНО (vercel.json: "0 * * * *"). На каждом запуске шлёт тем,
 * у кого сейчас 20:00 по их поясу (из города; по умолчанию Бали), кто сегодня
 * (по локальному дню) не заходил и кому ещё не напоминали в этот локальный день.
 * Текст ротируется случайно из POOL.
 *
 * Защита: Authorization: Bearer ${CRON_SECRET} (Vercel добавляет автоматически).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceSupabase } from '@/lib/supabase-service'
import { sendTelegramMessage } from '@/lib/telegram/send'

export const dynamic = 'force-dynamic'

const POOL = [
  'Верность и постоянство — ключ к успеху. Загляни в КРЕСТ сегодня 🙏',
  'Не хлебом единым жив человек (Мф. 4:4). Удели время КРЕСТу сегодня.',
  'Кто верен в малом, верен и в большом (Лк. 16:10). Зайди в КРЕСТ ✝️',
  'Маленький шаг каждый день рождает большую веру. Открой КРЕСТ.',
  'Ты ещё не заходил сегодня. Один шаг в КРЕСТ — и день прожит не зря.',
  'Я понимаю, уже поздно, но я и сам учился по вечерам. Верность и постоянство — залог успеха. Не забудь зайти 🙏',
  'День начинается с вечера. Успей зайти сегодня ✝️',
  'Не живи двойной жизнью. Будь верен пути — загляни в КРЕСТ.',
  'Не пропусти день — он начинается с вечера.',
]

const TARGET_HOUR = 20
const DEFAULT_TZ = 'Asia/Makassar'

function pick(): string {
  return POOL[Math.floor(Math.random() * POOL.length)]
}

/** Локальные час (0–23) и дата (YYYY-MM-DD) для часового пояса прямо сейчас. */
function localHourDate(tz: string): { hour: number; date: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  })
  const p: Record<string, string> = {}
  for (const part of fmt.formatToParts(new Date())) p[part.type] = part.value
  return { hour: parseInt(p.hour, 10) % 24, date: `${p.year}-${p.month}-${p.day}` }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceSupabase() as any

  // Ученики с Telegram + часовой пояс из города.
  const { data: students, error } = await supabase
    .from('profiles')
    .select('id, telegram_chat_id, cities(timezone)')
    .eq('role', 'student')
    .not('telegram_chat_id', 'is', null)
  if (error) {
    console.error('[evening-reminder] students', error)
    return NextResponse.json({ error: 'DB_ERROR' }, { status: 500 })
  }

  // Кому прямо сейчас 20:00 по их локальному времени.
  const due: { id: string; chatId: number; date: string }[] = []
  for (const s of students ?? []) {
    // Supabase может вернуть cities объектом или массивом — нормализуем.
    const c = s.cities
    const tz: string =
      (Array.isArray(c) ? c[0]?.timezone : c?.timezone) || DEFAULT_TZ
    let hd: { hour: number; date: string }
    try {
      hd = localHourDate(tz)
    } catch {
      hd = localHourDate(DEFAULT_TZ)
    }
    if (hd.hour === TARGET_HOUR && s.telegram_chat_id) {
      due.push({ id: s.id, chatId: Number(s.telegram_chat_id), date: hd.date })
    }
  }
  if (due.length === 0) return NextResponse.json({ ok: true, due: 0, sent: 0 })

  const ids = due.map((d) => d.id)
  const dueDates = [...new Set(due.map((d) => d.date))]

  // Кто открывал приложение за последние ~20 ч (= сегодня по локальному дню:
  // в 20:00 локально полночь была 20 ч назад). Сравнение timestamp — на стороне БД.
  const since = new Date(Date.now() - 20 * 3600 * 1000).toISOString()
  const { data: openedRows } = await supabase
    .from('student_daily_activity')
    .select('user_id')
    .in('user_id', ids)
    .eq('opened', true)
    .gte('opened_at', since)
  const openedToday = new Set<string>(((openedRows ?? []) as { user_id: string }[]).map((r) => r.user_id))

  // Кому уже напомнили в его локальный день.
  const { data: remRows } = await supabase
    .from('student_daily_activity')
    .select('user_id, activity_date')
    .in('user_id', ids)
    .in('activity_date', dueDates)
    .eq('reminded_evening', true)
  const reminded = new Set<string>(
    ((remRows ?? []) as { user_id: string; activity_date: string }[]).map(
      (r) => `${r.user_id}|${r.activity_date}`,
    ),
  )

  let sent = 0
  const nowIso = new Date().toISOString()
  for (const d of due) {
    if (openedToday.has(d.id)) continue
    if (reminded.has(`${d.id}|${d.date}`)) continue

    const ok = await sendTelegramMessage(d.chatId, `✝️ <b>КРЕСТ</b>\n\n${pick()}`, {
      withMiniAppButton: true,
    })
    if (!ok) continue
    sent++

    await supabase.from('student_daily_activity').upsert(
      { user_id: d.id, activity_date: d.date, reminded_evening: true, updated_at: nowIso },
      { onConflict: 'user_id,activity_date' },
    )
    await supabase.from('notifications_log').insert({
      user_id: d.id,
      channel: 'telegram',
      type: 'evening_reminder_local',
      status: 'sent',
    })
  }

  return NextResponse.json({ ok: true, due: due.length, sent })
}
