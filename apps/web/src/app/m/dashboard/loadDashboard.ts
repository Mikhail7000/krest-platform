import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../../../../packages/supabase/src/types'
import type { BlockCompletionData } from '@/lib/access/block-completion'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

export interface DashboardData {
  blocks: Block[]
  progressByBlockId: Record<number, BlockProgress>
  /** Данные для определения разблокировки — дневная модель */
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
    { data: closedDaysRows },
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

    // Закрытые дни по блокам — единый источник истины из rpc
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).rpc('user_closed_days', { p_user_id: userId }) as Promise<{
      data: Array<{ block_id: number; days: number }> | null
    }>,

    // Эпоха пятницы
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
  const canSkip = Boolean((profile as any)?.can_skip_block_lock)

  const midExamPassed = !!(examRows ?? []).find(
    (e) => e.exam_type === 'mid' && e.passed_at,
  )
  const finalExamPassed = !!(examRows ?? []).find(
    (e) => e.exam_type === 'final' && e.passed_at,
  )

  const courseDone = courseProgress?.status === 'completed'

  // Закрытые дни из rpc: map block_id → days
  const closedDaysByBlockId: Record<number, number> = {}
  for (const row of (closedDaysRows ?? []) as Array<{ block_id: number; days: number }>) {
    closedDaysByBlockId[row.block_id] = Number(row.days)
  }

  // Блоки с выполненной эпохой пятницы
  const fridayDoneByBlockId = new Set<number>()
  for (const row of (fridayRows ?? []) as Array<{ block_id: number }>) {
    fridayDoneByBlockId.add(row.block_id)
  }

  // Собираем completionByBlockId: closedDays + quiz + friday
  // quiz берём из student_block_progress (quiz_passed_at)
  const completionByBlockId: Record<number, BlockCompletionData> = {}

  // Все blockId, которые встречаются в любом из источников
  const allBlockIds = new Set<number>([
    ...(progressRows ?? []).map((r) => r.block_id),
    ...Object.keys(closedDaysByBlockId).map(Number),
    ...[...fridayDoneByBlockId],
  ])

  for (const blockId of allBlockIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const progAny = progressByBlockId[blockId] as any
    completionByBlockId[blockId] = {
      closedDays: closedDaysByBlockId[blockId] ?? 0,
      quiz: Boolean(progAny?.quiz_passed_at),
      fridayDone: fridayDoneByBlockId.has(blockId),
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
