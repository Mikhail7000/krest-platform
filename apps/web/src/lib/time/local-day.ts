/**
 * «Сегодня» по локальному часовому поясу ученика (день закрывается в 00:00 его пояса).
 * Пояс берётся из города ученика (cities.timezone); по умолчанию — Бали.
 * Прошлые записи (штампованные UTC) не трогаем — переход forward-only.
 */

export const DEFAULT_TZ = 'Asia/Makassar'

/** YYYY-MM-DD в указанном поясе прямо сейчас (en-CA даёт ISO-формат). */
export function localTodayStr(tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: DEFAULT_TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())
  }
}

/** Часовой пояс ученика из его города (или Бали по умолчанию). */
export async function studentTimezone(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  const { data } = await supabase
    .from('profiles')
    .select('cities(timezone)')
    .eq('id', userId)
    .maybeSingle()
  const c = (data as { cities?: unknown } | null)?.cities
  const tz = Array.isArray(c)
    ? (c[0] as { timezone?: string } | undefined)?.timezone
    : (c as { timezone?: string } | null)?.timezone
  return tz || DEFAULT_TZ
}

/** Удобный шорткат: локальная дата ученика «сегодня». */
export async function studentLocalToday(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
): Promise<string> {
  return localTodayStr(await studentTimezone(supabase, userId))
}
