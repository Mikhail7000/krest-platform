/**
 * Поиск «молчащих» учеников — нет активности (захода в приложение) >= N дней.
 * Используется И в кроне (пуш куратору), И в веб-панели куратора (блок-алерт).
 * Адресат уведомления — только КУРАТОР ученика (по curator_id); админам/супер-
 * админам это уведомление не шлётся.
 */

export const SILENCE_DAYS = 3

export interface SilentStudent {
  id: string
  name: string
  telegram: string | null
  curatorId: string
  daysSilent: number
  /** Последняя дата активности (ISO) или null, если ни разу не заходил. */
  lastActiveAt: string | null
}

/**
 * @param opts.curatorId — если задан, ищем только в группе этого куратора
 *                         (для панели); иначе по всем ученикам с куратором (для крона).
 */
export async function findSilentStudents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  opts: { curatorId?: string; minDays?: number } = {},
): Promise<SilentStudent[]> {
  const minDays = opts.minDays ?? SILENCE_DAYS

  let q = supabase
    .from('profiles')
    .select('id, full_name, contact_info, curator_id, course_started_at')
    .eq('role', 'student')
    .not('curator_id', 'is', null)
  if (opts.curatorId) q = q.eq('curator_id', opts.curatorId)

  const { data: studentsRaw } = await q
  const students = (studentsRaw ?? []) as Array<{
    id: string
    full_name: string | null
    contact_info: string | null
    curator_id: string
    course_started_at: string | null
  }>
  if (students.length === 0) return []

  const ids = students.map((s) => s.id)
  const { data: actRaw } = await supabase
    .from('student_daily_activity')
    .select('user_id, opened_at')
    .in('user_id', ids)
    .eq('opened', true)

  const lastByUser = new Map<string, string>()
  for (const a of (actRaw ?? []) as Array<{ user_id: string; opened_at: string | null }>) {
    if (!a.opened_at) continue
    const cur = lastByUser.get(a.user_id)
    if (!cur || a.opened_at > cur) lastByUser.set(a.user_id, a.opened_at)
  }

  const now = Date.now()
  const out: SilentStudent[] = []
  for (const s of students) {
    const last = lastByUser.get(s.id) ?? null
    // Если не заходил ни разу — считаем тишину от старта курса (если он начат).
    const ref = last ?? s.course_started_at
    if (!ref) continue // курс не начат и нет активности — не тревожим
    const days = Math.floor((now - new Date(ref).getTime()) / 86_400_000)
    if (days >= minDays) {
      out.push({
        id: s.id,
        name: s.full_name || s.contact_info || 'Ученик',
        telegram: s.contact_info ?? null,
        curatorId: s.curator_id,
        daysSilent: days,
        lastActiveAt: last,
      })
    }
  }
  out.sort((a, b) => b.daysSilent - a.daysSilent)
  return out
}
