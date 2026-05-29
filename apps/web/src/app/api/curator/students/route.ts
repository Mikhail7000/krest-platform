import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorAuth } from '@/lib/curator-auth'
import { createServiceSupabase } from '@/lib/supabase-service'
import { computeActivity } from '@/lib/activity/streak'
import { addDaysStr, baliToday } from '@/lib/time/bali'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = [
  'not_started',
  'video_watching',
  'quiz_passed',
  'locations_passed',
  'block_completed',
] as const

/**
 * GET /api/curator/students
 * Список студентов куратора с прогрессом.
 * Авторизация: curator / admin / super_admin
 *
 * Query params:
 *   block_id?  — фильтр по блоку (целое число)
 *   status?    — фильтр по статусу прогресса
 */
export async function GET(request: NextRequest) {
  const auth = await requireCuratorAuth()
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, role, supabase } = auth.curator

  const { searchParams } = new URL(request.url)

  const rawBlockId = searchParams.get('block_id')
  const rawStatus = searchParams.get('status')

  let blockId: number | undefined
  if (rawBlockId !== null) {
    blockId = parseInt(rawBlockId, 10)
    if (!Number.isInteger(blockId) || blockId <= 0) {
      return NextResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'block_id must be a positive integer' } },
        { status: 400 },
      )
    }
  }

  if (rawStatus !== null && !VALID_STATUSES.includes(rawStatus as typeof VALID_STATUSES[number])) {
    return NextResponse.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
        },
      },
      { status: 400 },
    )
  }
  const status = rawStatus as typeof VALID_STATUSES[number] | null

  // Fetch students — admin/super_admin see all, curator sees their own group
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profilesQuery = (supabase as any)
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('role', 'student')

  if (role === 'curator') {
    profilesQuery = profilesQuery.eq('curator_id', userId)
  }

  const { data: students, error: studentsError } = await profilesQuery
  if (studentsError) {
    console.error('[curator/students] profiles query error', studentsError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to load students' } },
      { status: 500 },
    )
  }

  if (!students || students.length === 0) {
    return NextResponse.json({ ok: true, data: [] })
  }

  const studentIds: string[] = (students as Array<{ id: string }>).map((s) => s.id)

  // Pending submissions count per student
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subsQuery = (supabase as any)
    .from('submissions')
    .select('user_id')
    .in('user_id', studentIds)
    .eq('status', 'pending')

  if (blockId) subsQuery = subsQuery.eq('block_id', blockId)

  const { data: pendingSubs } = await subsQuery

  // Last activity per student (latest submission created_at)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: lastActivity } = await (supabase as any)
    .from('submissions')
    .select('user_id, created_at')
    .in('user_id', studentIds)
    .order('created_at', { ascending: false })

  // Current block + status from student_block_progress
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let blockProgressQuery = (supabase as any)
    .from('student_block_progress')
    .select('user_id, block_id, status')
    .in('user_id', studentIds)
    .order('block_id', { ascending: false })

  if (blockId) blockProgressQuery = blockProgressQuery.eq('block_id', blockId)

  const { data: blockProgress } = await blockProgressQuery

  // Build lookup maps
  const pendingCountMap: Record<string, number> = {}
  for (const sub of pendingSubs ?? []) {
    pendingCountMap[sub.user_id] = (pendingCountMap[sub.user_id] ?? 0) + 1
  }

  const lastActivityMap: Record<string, string> = {}
  for (const act of lastActivity ?? []) {
    if (!lastActivityMap[act.user_id]) {
      lastActivityMap[act.user_id] = act.created_at
    }
  }

  const currentBlockMap: Record<string, number> = {}
  const blockStatusMap: Record<string, string> = {}
  for (const bp of blockProgress ?? []) {
    if (!currentBlockMap[bp.user_id]) {
      currentBlockMap[bp.user_id] = bp.block_id
      blockStatusMap[bp.user_id] = bp.status
    }
  }

  // Активность (заходы в КРЕСТ) — service-role: RLS пускает только свои строки,
  // а права куратора на этих учеников уже проверены фильтром выше.
  const service = createServiceSupabase()
  const sinceActivity = addDaysStr(baliToday(), -30)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: actRows } = await (service as any)
    .from('student_daily_activity')
    .select('user_id, activity_date')
    .in('user_id', studentIds)
    .eq('opened', true)
    .gte('activity_date', sinceActivity)

  const datesByUser: Record<string, string[]> = {}
  for (const r of (actRows ?? []) as { user_id: string; activity_date: string }[]) {
    ;(datesByUser[r.user_id] ??= []).push(r.activity_date)
  }

  const MS_PER_DAY = 86_400_000
  const now = Date.now()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (students as any[]).flatMap((student) => {
    const studentStatus = blockStatusMap[student.id] ?? 'not_started'
    const currentBlock = currentBlockMap[student.id] ?? 1

    // Apply status filter
    if (status && studentStatus !== status) return []

    const lastAt = lastActivityMap[student.id] ?? null
    const daysSilent = lastAt
      ? Math.floor((now - new Date(lastAt).getTime()) / MS_PER_DAY)
      : 0

    const act = computeActivity(datesByUser[student.id] ?? [], 7)

    return [{
      id: student.id,
      full_name: student.full_name ?? null,
      avatar_url: student.avatar_url ?? null,
      current_block: currentBlock,
      status: studentStatus,
      last_activity_at: lastAt,
      submissions_pending: pendingCountMap[student.id] ?? 0,
      days_silent: daysSilent,
      streak: act.streak,
      opened_today: act.openedToday,
    }]
  })

  return NextResponse.json({ ok: true, data })
}
