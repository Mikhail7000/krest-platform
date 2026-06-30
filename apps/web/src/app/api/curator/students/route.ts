import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorViaInitData } from '@/lib/curator-auth'
import { createServiceSupabase } from '@/lib/supabase-service'
import { computeActivity } from '@/lib/activity/streak'
import { addDaysStr, baliToday } from '@/lib/time/bali'
import { localTodayStr, DEFAULT_TZ } from '@/lib/time/local-day'

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
  const auth = await requireCuratorViaInitData(request.headers.get('x-init-data') ?? '')
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
    .select('id, full_name, avatar_url, cities(timezone)')
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

    // «Сегодня» — по поясу города КОНКРЕТНОГО ученика (stream из join cities(timezone)).
    const sc = student.cities
    const stz =
      (Array.isArray(sc) ? sc[0]?.timezone : sc?.timezone) || DEFAULT_TZ
    const act = computeActivity(datesByUser[student.id] ?? [], [], 7, localTodayStr(stz))
    // дней молчания = с последнего захода (по активности, а не по сабмишенам)
    const lastAt = act.lastActive
    const daysSilent = lastAt
      ? Math.floor((now - new Date(`${lastAt}T00:00:00Z`).getTime()) / MS_PER_DAY)
      : 0

    return [{
      id: student.id,
      full_name: student.full_name ?? null,
      avatar_url: student.avatar_url ?? null,
      current_block: currentBlock,
      status: studentStatus,
      last_activity_at: lastAt,
      submissions_pending: 0,
      days_silent: daysSilent,
      streak: act.streak,
      opened_today: act.openedToday,
    }]
  })

  return NextResponse.json({ ok: true, data })
}
