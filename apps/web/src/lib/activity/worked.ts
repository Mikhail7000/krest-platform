import { addDaysStr, baliDateOf } from '@/lib/time/bali'

// Таблицы реальных действий ученика (вместо несуществующей `submissions`).
// «Что-то делал в этот день» = появилась запись в любой из них.
const WORK_TABLES = [
  'student_quiz_attempts',
  'student_location_attempts',
  'student_block_recitations',
  'student_block_daily_cross',
  'student_block_daily_prayer',
  'student_block_emotions',
  'student_block_friday_practice',
  'video_watch_progress',
] as const

/**
 * Дни (по Бали), когда ученик что-то делал — для «зелёных» кубиков прогресса.
 * Берём created_at из всех таблиц активности начиная с sinceDateStr.
 */
export async function getWorkedDates(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  sinceDateStr: string,
): Promise<string[]> {
  const sinceTs = `${addDaysStr(sinceDateStr, -1)}T00:00:00Z`
  const set = new Set<string>()

  for (const table of WORK_TABLES) {
    const { data } = await supabase
      .from(table)
      .select('created_at')
      .eq('user_id', userId)
      .gte('created_at', sinceTs)
    for (const row of (data ?? []) as { created_at: string | null }[]) {
      if (row?.created_at) set.add(baliDateOf(row.created_at))
    }
  }

  return [...set]
}
