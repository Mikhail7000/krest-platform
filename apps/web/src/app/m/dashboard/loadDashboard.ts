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

  // Считаем уникальные дни фото креста по блоку в TS (distinct submitted_date)
  const crossDaysByBlockId: Record<number, Set<string>> = {}
  for (const row of crossRows ?? []) {
    const blockId = row.block_id
    if (!crossDaysByBlockId[blockId]) {
      crossDaysByBlockId[blockId] = new Set()
    }
    crossDaysByBlockId[blockId].add(row.submitted_date)
  }

  // Собираем completionByBlockId из progress + crossDays
  const completionByBlockId: Record<number, BlockCompletionData> = {}
  for (const row of progressRows ?? []) {
    completionByBlockId[row.block_id] = {
      quiz_passed_at: row.quiz_passed_at,
      recitation_audio_passed_at: row.recitation_audio_passed_at,
      recitation_videos_passed_at: row.recitation_videos_passed_at,
      crossDays: crossDaysByBlockId[row.block_id]?.size ?? 0,
    }
  }
  // Блоки без progress-записи тоже могут иметь cross-данные (edge case)
  for (const [blockIdStr, daysSet] of Object.entries(crossDaysByBlockId)) {
    const blockId = Number(blockIdStr)
    if (!completionByBlockId[blockId]) {
      completionByBlockId[blockId] = {
        quiz_passed_at: null,
        recitation_audio_passed_at: null,
        recitation_videos_passed_at: null,
        crossDays: daysSet.size,
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
