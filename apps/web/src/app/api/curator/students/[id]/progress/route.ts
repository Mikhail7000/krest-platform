import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorViaInitData } from '@/lib/curator-auth'
import { computeActivity } from '@/lib/activity/streak'
import { getWorkedDates } from '@/lib/activity/worked'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * GET /api/curator/students/{student_id}/progress
 * Прогресс ученика по блокам + активность (заходы/действия).
 * Авторизация (Telegram initData): curator (только своих) / admin / super_admin.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCuratorViaInitData(request.headers.get('x-init-data') ?? '')
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, role, supabase } = auth.curator

  const { id: studentId } = await params
  if (!UUID_RE.test(studentId)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid student_id (must be UUID)' } },
      { status: 400 },
    )
  }

  // Доступ: куратор видит только своих учеников
  if (role === 'curator') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studentProfile } = await (supabase as any)
      .from('profiles')
      .select('id, curator_id')
      .eq('id', studentId)
      .maybeSingle()
    if (!studentProfile) {
      return NextResponse.json({ error: { code: 'NOT_FOUND', message: 'Student not found' } }, { status: 404 })
    }
    if (studentProfile.curator_id !== userId) {
      return NextResponse.json({ error: { code: 'FORBIDDEN', message: 'Student is not in your group' } }, { status: 403 })
    }
  }

  // Прогресс по блокам (реальная таблица student_block_progress)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blockProgress, error: bpError } = await (supabase as any)
    .from('student_block_progress')
    .select('block_id, status, block_completed_at, block_passed_at, quiz_passed_at, locations_passed_at')
    .eq('user_id', studentId)
    .order('block_id', { ascending: true })

  if (bpError) {
    console.error('[curator/students/progress] block_progress error', bpError)
    return NextResponse.json({ error: { code: 'DB_ERROR', message: 'Failed to load block progress' } }, { status: 500 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = (blockProgress ?? []).map((bp: any) => ({
    block_id: bp.block_id,
    status: bp.status,
    completed_at: bp.block_completed_at ?? bp.block_passed_at ?? null,
    quiz_passed: !!bp.quiz_passed_at,
    locations_passed: !!bp.locations_passed_at,
    passed: !!bp.block_passed_at,
  }))

  // Активность: заходы + дни реальных действий
  const since = addDaysStr(baliToday(), -30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actRows } = await (supabase as any)
    .from('student_daily_activity')
    .select('activity_date')
    .eq('user_id', studentId)
    .eq('opened', true)
    .gte('activity_date', since)
  const opened = ((actRows ?? []) as { activity_date: string }[]).map((r) => r.activity_date)
  const worked = await getWorkedDates(supabase, studentId, since)
  const activity = computeActivity(opened, worked, 14)

  return NextResponse.json({
    ok: true,
    data: { student_id: studentId, blocks, activity },
  })
}
