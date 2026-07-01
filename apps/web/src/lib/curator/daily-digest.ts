import { sendTelegramMessage, escapeHtml } from '@/lib/telegram/send'

/**
 * Дневная сводка куратору по его группе: кто ВЧЕРА закрыл день, кто нет.
 * «Вчера» — по локальному поясу города КАЖДОГО ученика (канон: границы дня —
 * полночь пояса города). Считаются только начавшие курс и не скрытые.
 * Идемпотентно: раз в UTC-сутки на куратора (curator_notify_state, event 'digest').
 * Вызывается из cron silence-check (лимит Vercel — 2 cron-слота, отдельного нет).
 */

const DEFAULT_TZ = 'Asia/Makassar'

/** Вчерашняя локальная дата пояса (граница дня — полночь пояса). */
function localYesterday(tz: string): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(new Date(Date.now() - 86_400_000))
}

export async function sendCuratorDigests(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
): Promise<number> {
  const todayKey = new Date().toISOString().slice(0, 10)

  const [{ data: curatorsRaw }, { data: studentsRaw }, { data: citiesRaw }, { data: closedRaw }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, telegram_chat_id')
        .eq('role', 'curator')
        .not('telegram_chat_id', 'is', null),
      supabase
        .from('profiles')
        .select('id, full_name, contact_info, curator_id, city_id, course_started_at, hidden_from_tracking')
        .eq('role', 'student')
        .not('curator_id', 'is', null),
      supabase.from('cities').select('id, timezone'),
      supabase.rpc('closed_dates_all'),
    ])

  const tzByCity = new Map<number, string>()
  for (const c of (citiesRaw ?? []) as { id: number; timezone: string | null }[]) {
    if (c.timezone) tzByCity.set(c.id, c.timezone)
  }
  const closedByUser = new Map<string, Set<string>>()
  for (const r of (closedRaw ?? []) as { user_id: string; d: string }[]) {
    const set = closedByUser.get(r.user_id) ?? new Set<string>()
    set.add(r.d)
    closedByUser.set(r.user_id, set)
  }
  const yesterdayByTz = new Map<string, string>()
  const yesterdayOf = (tz: string) => {
    let d = yesterdayByTz.get(tz)
    if (!d) {
      d = localYesterday(tz)
      yesterdayByTz.set(tz, d)
    }
    return d
  }

  interface Stu {
    name: string
    curator_id: string
    closedY: boolean
  }
  const byCurator = new Map<string, Stu[]>()
  for (const s of (studentsRaw ?? []) as Array<{
    id: string
    full_name: string | null
    contact_info: string | null
    curator_id: string
    city_id: number | null
    course_started_at: string | null
    hidden_from_tracking: boolean | null
  }>) {
    if (s.hidden_from_tracking || !s.course_started_at) continue
    const tz = (s.city_id != null ? tzByCity.get(s.city_id) : null) ?? DEFAULT_TZ
    const y = yesterdayOf(tz)
    const list = byCurator.get(s.curator_id) ?? []
    list.push({
      name: s.full_name || s.contact_info || 'Ученик',
      curator_id: s.curator_id,
      closedY: closedByUser.get(s.id)?.has(y) ?? false,
    })
    byCurator.set(s.curator_id, list)
  }

  let sent = 0
  for (const cur of (curatorsRaw ?? []) as Array<{
    id: string
    full_name: string | null
    telegram_chat_id: number | string | null
  }>) {
    const group = byCurator.get(cur.id) ?? []
    if (group.length === 0) continue
    const chatId = Number(cur.telegram_chat_id)
    if (!Number.isFinite(chatId)) continue

    // Раз в UTC-сутки на куратора (state-таблица переиспользуется: student_id=куратор).
    const { error: dupErr } = await supabase
      .from('curator_notify_state')
      .insert({ student_id: cur.id, event_type: 'digest', event_key: todayKey })
    if (dupErr) continue

    const closed = group.filter((s) => s.closedY)
    const missed = group.filter((s) => !s.closedY)
    const names = (list: Stu[]) => list.map((s) => escapeHtml(s.name)).join(', ')
    const parts = [`📊 <b>Сводка за вчера</b> — группа ${group.length} чел.`]
    parts.push(
      closed.length > 0
        ? `✅ Закрыли день (${closed.length}): ${names(closed)}`
        : '✅ Закрывших день вчера нет.',
    )
    if (missed.length > 0) parts.push(`⚠️ Не закрыли (${missed.length}): ${names(missed)}`)

    const ok = await sendTelegramMessage(chatId, parts.join('\n\n'))
    if (ok) sent++
  }
  return sent
}
