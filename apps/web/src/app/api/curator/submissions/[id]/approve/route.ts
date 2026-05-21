import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorAuth } from '@/lib/curator-auth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Recurring types requiring ≥7 unique approved submission days
const RECURRING_TYPES = ['daily_cross', 'daily_report']
// Non-recurring required assignment types to complete a block
const REQUIRED_SINGLE = ['reflection_forum', 'summary', 'locations', 'friday_practice']

/**
 * POST /api/curator/submissions/{submission_id}/approve
 * Одобрить сабмишен студента.
 * Авторизация: curator (только для студентов своей группы) / admin / super_admin
 *
 * Ответ 200:
 *   { ok: true, data: { id, status, reviewed_at, block_completed } }
 * Ответ 404: сабмишен не найден
 * Ответ 409: сабмишен уже проверен
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireCuratorAuth()
  if ('errorResponse' in auth) return auth.errorResponse
  const { userId, role, supabase } = auth.curator

  const { id: submissionId } = await params

  if (!UUID_RE.test(submissionId)) {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'Invalid submission_id (must be UUID)' } },
      { status: 400 },
    )
  }

  // Fetch submission
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submission, error: fetchError } = await (supabase as any)
    .from('submissions')
    .select('id, user_id, block_id, status, assignment_type, daily_recurring')
    .eq('id', submissionId)
    .maybeSingle()

  if (fetchError || !submission) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Submission not found' } },
      { status: 404 },
    )
  }

  // Access control: curator must own this student
  if (role === 'curator') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studentProfile } = await (supabase as any)
      .from('profiles')
      .select('curator_id')
      .eq('id', submission.user_id)
      .maybeSingle()

    if (!studentProfile || studentProfile.curator_id !== userId) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: 'Student is not in your group' } },
        { status: 403 },
      )
    }
  }

  if (submission.status !== 'pending') {
    return NextResponse.json(
      {
        error: {
          code: 'ALREADY_REVIEWED',
          message: `Submission already has status: ${submission.status}`,
        },
      },
      { status: 409 },
    )
  }

  const reviewedAt = new Date().toISOString()

  // Update to approved
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('submissions')
    .update({
      status: 'approved',
      reviewer_id: userId,
      reviewed_at: reviewedAt,
    })
    .eq('id', submissionId)

  if (updateError) {
    console.error('[curator/submissions/approve] update error', updateError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to approve submission' } },
      { status: 500 },
    )
  }

  // Check if this approval completes the block
  const blockCompleted = await checkBlockCompleted(supabase, submission.user_id, submission.block_id)

  // Best-effort: mark related new_submission notifications as read
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(supabase as any)
    .from('notifications_log')
    .update({ read_at: reviewedAt })
    .eq('student_id', submission.user_id)
    .eq('block_id', submission.block_id)
    .eq('notification_type', 'new_submission')
    .is('read_at', null)
    .then(() => {
      // fire-and-forget
    })
    .catch((e: unknown) => {
      console.error('[curator/submissions/approve] notification read error', e)
    })

  return NextResponse.json({
    ok: true,
    data: {
      id: submissionId,
      status: 'approved',
      reviewed_at: reviewedAt,
      block_completed: blockCompleted,
    },
  })
}

/**
 * Determines whether all required submissions for a block are approved/auto_approved.
 * - Non-recurring (reflection_forum, summary, locations, friday_practice): need 1 approved
 * - Recurring (daily_cross, daily_report): need ≥7 approved rows
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkBlockCompleted(supabase: any, userId: string, blockId: number): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: subs } = await (supabase as any)
      .from('submissions')
      .select('assignment_type, status')
      .eq('user_id', userId)
      .eq('block_id', blockId)
      .in('status', ['approved', 'auto_approved'])

    if (!subs || subs.length === 0) return false

    // Check required single-submission types
    const approvedTypes = new Set<string>(
      (subs as Array<{ assignment_type: string }>).map((s) => s.assignment_type),
    )
    for (const required of REQUIRED_SINGLE) {
      if (!approvedTypes.has(required)) return false
    }

    // Check recurring types: count approved submissions per type
    for (const recurring of RECURRING_TYPES) {
      const count = (subs as Array<{ assignment_type: string }>).filter(
        (s) => s.assignment_type === recurring,
      ).length
      if (count < 7) return false
    }

    return true
  } catch (e) {
    console.error('[checkBlockCompleted] error', e)
    return false
  }
}
