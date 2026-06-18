import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../../../../packages/supabase/src/types'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

export interface DashboardData {
  blocks: Block[]
  progressByBlockId: Record<number, BlockProgress>
  canSkip: boolean
  courseStartedAt: string | null
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
  ] = await Promise.all([
    supabase
      .from('student_block_progress')
      .select('*')
      .eq('user_id', userId),
    supabase
      .from('profiles')
      // course_started_at — новая колонка, типы ещё не регенерированы
      .select('can_skip_block_lock, course_started_at')
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
  ])

  const progressByBlockId: Record<number, BlockProgress> = {}
  for (const row of progressRows ?? []) {
    progressByBlockId[row.block_id] = row
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileAny = profile as any
  const canSkip = profileAny?.can_skip_block_lock ?? false
  const courseStartedAt: string | null = profileAny?.course_started_at ?? null

  const midExamPassed = !!(examRows ?? []).find(
    (e) => e.exam_type === 'mid' && e.passed_at,
  )
  const finalExamPassed = !!(examRows ?? []).find(
    (e) => e.exam_type === 'final' && e.passed_at,
  )

  const courseDone = courseProgress?.status === 'completed'

  return {
    blocks: (blocks ?? []) as Block[],
    progressByBlockId,
    canSkip,
    courseStartedAt,
    midExamPassed,
    finalExamPassed,
    courseDone,
  }
}
