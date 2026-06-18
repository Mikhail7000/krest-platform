import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../../../../packages/supabase/src/types'
import type { BlockCompletionData } from '@/lib/access/block-completion'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

export interface DashboardData {
  blocks: Block[]
  progressByBlockId: Record<number, BlockProgress>
  /** Накопительные данные для определения разблокировки блоков */
  completionByBlockId: Record<number, BlockCompletionData>
  canSkip: boolean
  midExamPassed: boolean
  finalExamPassed: boolean
  courseDone: boolean
}

const adminClient = () =>
  createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )

export async function loadDashboardData(userId: string): Promise<DashboardData> {
  const supabase = adminClient()

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, title_ru, subtitle_ru, color, order_num, course_id')
    .eq('course_id', 1)
    .order('order_num', { ascending: true })

  const [
    { data: progressRows },
    { data: profile },
    { data: examRows },
    { data: courseProgress },
    { data: crossRows },
    { data: prayerRows },
    { data: fridayRows },
  ] = await Promise.all([
    supabase
      .from('student_block_progress')
      .select('*')
      .eq('user_id', userId),
    supabase
      .from('profiles')
      .select('can_skip_block_lock')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('student_exam_progress')
      .select('exam_type, passed_at')
      .eq('user_id', userId),
    supabase
      .from('course_progress')
      .select('status')
      .eq('user_id', userId)
      .eq('course_id', 1)
      .maybeSingle(),
    // Уникальные дни фото креста: один row = один день в одном блоке
    supabase
      .from('student_block_daily_cross')
      .select('block_id, submitted_date')
      .eq('user_id', userId),
    // Уникальные дни молитвы (новая таблица, not in types.ts → as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('student_block_daily_prayer')
      .select('block_id, prayed_date')
      .eq('user_id', userId) as Promise<{ data: Array<{ block_id: number; prayed_date: string }> | null }>,
    // Эпоха пятницы (новая таблица, not in types.ts → as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any)
      .from('student_block_friday_practice')
      .select('block_id')
      .eq('user_id', userId) as Promise<{ data: Array<{ block_id: number }> | null }>,
  ])

  const progressByBlockId: Record<number, BlockProgress> = {}
  for (const row of progressRows ?? []) {
    progressByBlockId[row.block_id] = row
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileAny = profile as any
  const canSkip = profileAny?.can_skip_block_lock ?? false

  const midExamPassed = !!(examRows ?? []).find(
    (e) => e.exam_type === 'mid' && e.passed_at,
  )
  const finalExamPassed = !!(examRows ?? []).find(
    (e) => e.exam_type === 'final' && e.passed_at,
  )

  const courseDone = courseProgress?.status === 'completed'

  // Считаем уникальные дни фото креста по блоку
  const crossDaysByBlockId: Record<number, Set<string>> = {}
  for (const row of crossRows ?? []) {
    const blockId = row.block_id
    if (!crossDaysByBlockId[blockId]) {
      crossDaysByBlockId[blockId] = new Set()
    }
    crossDaysByBlockId[blockId].add(row.submitted_date)
  }

  // Считаем уникальные дни молитвы по блоку
  const prayerDaysByBlockId: Record<number, Set<string>> = {}
  for (const row of prayerRows ?? []) {
    if (!prayerDaysByBlockId[row.block_id]) {
      prayerDaysByBlockId[row.block_id] = new Set()
    }
    prayerDaysByBlockId[row.block_id].add(row.prayed_date)
  }

  // Блоки с выполненной эпохой пятницы
  const fridayDoneByBlockId = new Set<number>()
  for (const row of fridayRows ?? []) {
    fridayDoneByBlockId.add(row.block_id)
  }

  // Собираем completionByBlockId из progress + crossDays + prayerDays + fridayDone
  const completionByBlockId: Record<number, BlockCompletionData> = {}
  for (const row of progressRows ?? []) {
    const blockId = row.block_id
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowAny = row as any
    completionByBlockId[blockId] = {
      quiz_passed_at: rowAny.quiz_passed_at ?? null,
      recitation_audio_passed_at: rowAny.recitation_audio_passed_at ?? null,
      recitation_videos_passed_at: rowAny.recitation_videos_passed_at ?? null,
      trainer_passed_at: rowAny.trainer_passed_at ?? null,
      crossDays: crossDaysByBlockId[blockId]?.size ?? 0,
      prayerDays: prayerDaysByBlockId[blockId]?.size ?? 0,
      fridayDone: fridayDoneByBlockId.has(blockId),
    }
  }

  // Блоки без progress-записи тоже могут иметь cross/prayer/friday данные (edge case)
  const allBlockIds = new Set<number>([
    ...Object.keys(crossDaysByBlockId).map(Number),
    ...Object.keys(prayerDaysByBlockId).map(Number),
    ...[...fridayDoneByBlockId],
  ])
  for (const blockId of allBlockIds) {
    if (!completionByBlockId[blockId]) {
      completionByBlockId[blockId] = {
        quiz_passed_at: null,
        recitation_audio_passed_at: null,
        recitation_videos_passed_at: null,
        trainer_passed_at: null,
        crossDays: crossDaysByBlockId[blockId]?.size ?? 0,
        prayerDays: prayerDaysByBlockId[blockId]?.size ?? 0,
        fridayDone: fridayDoneByBlockId.has(blockId),
      }
    }
  }

  return {
    blocks: (blocks ?? []) as Block[],
    progressByBlockId,
    completionByBlockId,
    canSkip,
    midExamPassed,
    finalExamPassed,
    courseDone,
  }
}
