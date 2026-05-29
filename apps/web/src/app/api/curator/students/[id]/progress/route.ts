import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorViaInitData } from '@/lib/curator-auth'
import { createServiceSupabase } from '@/lib/supabase-service'
import { computeActivity } from '@/lib/activity/streak'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Recurring assignment types that require ≥7 unique approved days
const RECURRING_TYPES = ['daily_cross', 'daily_report']

/**
 * GET /api/curator/students/{student_id}/progress
 * Детальный прогресс студента по всем блокам + список сабмишенов.
 * Авторизация: curator (только своих студентов) / admin / super_admin
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

  // Access control: curator can only view students in their group
  if (role === 'curator') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studentProfile } = await (supabase as any)
      .from('profiles')
      .select('id, curator_id')
      .eq('id', studentId)
      .maybeSingle()

    if (!studentProfile) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Student not found' } },
        { status: 404 },
      )
    }
    if (studentProfile.curator_id !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Student is not in your group' } },
        { status: 403 },
      )
    }
  }

  // Fetch block-level progress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: blockProgress, error: bpError } = await (supabase as any)
    .from('student_block_progress')
    .select('block_id, status, completed_at')
    .eq('user_id', studentId)
    .order('block_id', { ascending: true })

  if (bpError) {
    console.error('[curator/students/progress] block_progress error', bpError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to load block progress' } },
      { status: 500 },
    )
  }

  // Fetch all submissions for this student
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submissions, error: subError } = await (supabase as any)
    .from('submissions')
    .select(
      'id, block_id, assignment_type, status, daily_recurring, submission_date, reviewed_at',
    )
    .eq('user_id', studentId)
    .order('submission_date', { ascending: true })

  if (subError) {
    console.error('[curator/students/progress] submissions error', subError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to load submissions' } },
      { status: 500 },
    )
  }

  // Group submissions by block_id
  const subsByBlock: Record<number, typeof submissions> = {}
  for (const sub of submissions ?? []) {
    if (!subsByBlock[sub.block_id]) subsByBlock[sub.block_id] = []
    subsByBlock[sub.block_id].push(sub)
  }

  // Summarize per-block submissions (collapsing recurring into counts)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function summarizeSubmissions(subs: any[]) {
    const byType: Record<string, typeof subs> = {}
    for (const s of subs) {
      if (!byType[s.assignment_type]) byType[s.assignment_type] = []
      byType[s.assignment_type].push(s)
    }

    return Object.entries(byType).map(([assignmentType, entries]) => {
      const isRecurring = RECURRING_TYPES.includes(assignmentType)
      const latest = entries[entries.length - 1]

      if (isRecurring) {
        const approvedDays = entries.filter(
          (e) => e.status === 'approved' || e.status === 'auto_approved',
        ).length
        return {
          id: latest.id,
          assignment_type: assignmentType,
          status: latest.status,
          submission_count: approvedDays,
          needed_count: 7,
          reviewed_at: latest.reviewed_at ?? null,
        }
      }

      return {
        id: latest.id,
        assignment_type: assignmentType,
        status: latest.status,
        reviewed_at: latest.reviewed_at ?? null,
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const blocks = (blockProgress ?? []).map((bp: any) => ({
    block_id: bp.block_id,
    status: bp.status,
    completed_at: bp.completed_at ?? null,
    submissions: summarizeSubmissions(subsByBlock[bp.block_id] ?? []),
  }))

  // Активность (заходы в КРЕСТ) — читаем service-role: RLS на student_daily_activity
  // разрешает только свои строки, а доступ куратора к ученику уже проверен выше.
  const service = createServiceSupabase()
  const since = addDaysStr(baliToday(), -30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actRows } = await (service as any)
    .from('student_daily_activity')
    .select('activity_date')
    .eq('user_id', studentId)
    .eq('opened', true)
    .gte('activity_date', since)
  const activity = computeActivity(
    ((actRows ?? []) as { activity_date: string }[]).map((r) => r.activity_date),
    14,
  )

  return NextResponse.json({
    ok: true,
    data: {
      student_id: studentId,
      blocks,
      activity,
    },
  })
}

