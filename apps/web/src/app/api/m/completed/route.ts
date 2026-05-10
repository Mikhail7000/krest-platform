import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

export async function POST(req: NextRequest) {
  // 1. Parse body and resolve user
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const initData = body.initData ?? ''

  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const supabase = createServiceSupabase()

  // 2. Read course_progress for КРЕСТ (course_id=1)
  const { data: cp, error: cpErr } = await supabase
    .from('course_progress')
    .select('status, completed_at, final_exam_passed_at')
    .eq('user_id', userId)
    .eq('course_id', 1)
    .maybeSingle()

  if (cpErr) {
    console.error('[completed] course_progress fetch error:', cpErr)
    return err('Failed to load course progress', 'DB_ERROR', 500)
  }

  if (cp?.status !== 'completed') {
    return NextResponse.json({ ok: true, completed: false })
  }

  // 3. Read final exam score
  const { data: examProgress } = await supabase
    .from('student_exam_progress')
    .select('last_score_pct')
    .eq('user_id', userId)
    .eq('exam_type', 'final')
    .maybeSingle()

  // 4. Read next course info (10-pisem, course_id=2)
  const { data: nextCourse } = await supabase
    .from('courses')
    .select('slug, title_ru, status')
    .eq('id', 2)
    .maybeSingle()

  const { data: nextProgress } = await supabase
    .from('course_progress')
    .select('status')
    .eq('user_id', userId)
    .eq('course_id', 2)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    completed: true,
    completed_at: cp.completed_at,
    final_score: examProgress?.last_score_pct ?? null,
    next_course: nextCourse
      ? {
          slug: nextCourse.slug,
          title: nextCourse.title_ru,
          status: nextProgress?.status ?? nextCourse.status,
        }
      : null,
  })
}
