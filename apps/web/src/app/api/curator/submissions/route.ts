import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorAuth } from '@/lib/curator-auth'

export const dynamic = 'force-dynamic'

const VALID_STATUSES = ['pending', 'approved', 'auto_approved', 'rejected'] as const

/**
 * GET /api/curator/submissions
 * Очередь сабмишенов студентов куратора для проверки.
 * Авторизация: curator / admin / super_admin
 *
 * Query params:
 *   block_id?  — фильтр по блоку
 *   status?    — фильтр по статусу (default: все)
 *   limit?     — максимум результатов (1–100, default 50)
 *   offset?    — пагинация (default 0)
 */
export async function GET(request: NextRequest) {
  const auth = await requireCuratorAuth()
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, role, supabase } = auth.curator

  const { searchParams } = new URL(request.url)

  // Validate query params manually (no zod dependency)
  const rawBlockId = searchParams.get('block_id')
  const rawStatus = searchParams.get('status')
  const rawLimit = searchParams.get('limit') ?? '50'
  const rawOffset = searchParams.get('offset') ?? '0'

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

  const limit = Math.min(Math.max(parseInt(rawLimit, 10) || 50, 1), 100)
  const offset = Math.max(parseInt(rawOffset, 10) || 0, 0)

  // Get students for this curator
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let studentsQuery = (supabase as any)
    .from('profiles')
    .select('id')
    .eq('role', 'student')

  if (role === 'curator') {
    studentsQuery = studentsQuery.eq('curator_id', userId)
  }

  const { data: students, error: studentsError } = await studentsQuery
  if (studentsError) {
    console.error('[curator/submissions] students query error', studentsError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to load students' } },
      { status: 500 },
    )
  }

  if (!students || students.length === 0) {
    return NextResponse.json({
      ok: true,
      data: [],
      meta: { total: 0, limit, offset },
    })
  }

  const studentIds: string[] = (students as Array<{ id: string }>).map((s) => s.id)

  // Fetch submissions with inline profile join for student name
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let subsQuery = (supabase as any)
    .from('submissions')
    .select(
      `id,
       user_id,
       block_id,
       assignment_type,
       content_text,
       media_url,
       media_type,
       status,
       created_at,
       profiles:user_id ( full_name )`,
    )
    .in('user_id', studentIds)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (blockId) subsQuery = subsQuery.eq('block_id', blockId)
  if (status) subsQuery = subsQuery.eq('status', status)

  const { data: submissions, error: subsError } = await subsQuery
  if (subsError) {
    console.error('[curator/submissions] query error', subsError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to load submissions' } },
      { status: 500 },
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = (submissions ?? []).map((sub: any) => ({
    id: sub.id,
    student_id: sub.user_id,
    student_name: sub.profiles?.full_name ?? null,
    block_id: sub.block_id,
    assignment_type: sub.assignment_type,
    content_text: sub.content_text ?? null,
    media_url: sub.media_url ?? null,
    media_type: sub.media_type ?? null,
    created_at: sub.created_at,
    status: sub.status,
  }))

  return NextResponse.json({
    ok: true,
    data,
    meta: { total: data.length, limit, offset },
  })
}
