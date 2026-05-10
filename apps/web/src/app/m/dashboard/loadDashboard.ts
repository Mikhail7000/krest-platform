import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../../../../../packages/supabase/src/types'

type Block = Database['public']['Tables']['blocks']['Row']
type BlockProgress = Database['public']['Tables']['student_block_progress']['Row']

export interface DashboardData {
  blocks: Block[]
  progressByBlockId: Record<number, BlockProgress>
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

export async function loadDashboardData(): Promise<DashboardData> {
  const supabase = adminClient()
  const userId = process.env.DEV_BYPASS_USER_ID

  const { data: blocks } = await supabase
    .from('blocks')
    .select('id, title_ru, order_num, course_id')
    .eq('course_id', 1)
    .order('order_num', { ascending: true })

  if (!userId) {
    return {
      blocks: (blocks ?? []) as Block[],
      progressByBlockId: {},
      canSkip: false,
      midExamPassed: false,
      finalExamPassed: false,
      courseDone: false,
    }
  }

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
  ])

  const progressByBlockId: Record<number, BlockProgress> = {}
  for (const row of progressRows ?? []) {
    progressByBlockId[row.block_id] = row
  }

  const canSkip = profile?.can_skip_block_lock ?? false

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
    midExamPassed,
    finalExamPassed,
    courseDone,
  }
}
