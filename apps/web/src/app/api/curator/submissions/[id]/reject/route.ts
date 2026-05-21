import { NextRequest, NextResponse } from 'next/server'
import { requireCuratorAuth } from '@/lib/curator-auth'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MIN_COMMENT_LENGTH = 10
const MAX_COMMENT_LENGTH = 1000

/**
 * POST /api/curator/submissions/{submission_id}/reject
 * Отклонить сабмишен студента с обязательным комментарием (≥10 символов).
 * Авторизация: curator (только для студентов своей группы) / admin / super_admin
 *
 * Body: { comment: string }
 * Ответ 200: { ok: true, data: { id, status, reviewer_comment, reviewed_at } }
 * Ответ 400: { error: { code: "COMMENT_TOO_SHORT", message: "..." } }
 */
export async function POST(
  request: NextRequest,
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

  // Parse and validate request body
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON' } },
      { status: 400 },
    )
  }

  const comment = body?.comment
  if (typeof comment !== 'string') {
    return NextResponse.json(
      { error: { code: 'VALIDATION_ERROR', message: 'comment is required and must be a string' } },
      { status: 400 },
    )
  }
  if (comment.length < MIN_COMMENT_LENGTH) {
    return NextResponse.json(
      {
        error: {
          code: 'COMMENT_TOO_SHORT',
          message: `Comment must be at least ${MIN_COMMENT_LENGTH} characters`,
        },
      },
      { status: 400 },
    )
  }
  if (comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      {
        error: {
          code: 'COMMENT_TOO_LONG',
          message: `Comment must be at most ${MAX_COMMENT_LENGTH} characters`,
        },
      },
      { status: 400 },
    )
  }

  // Fetch submission
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: submission, error: fetchError } = await (supabase as any)
    .from('submissions')
    .select('id, user_id, block_id, status')
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

  // Update to rejected
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateError } = await (supabase as any)
    .from('submissions')
    .update({
      status: 'rejected',
      reviewer_id: userId,
      reviewer_comment: comment,
      reviewed_at: reviewedAt,
    })
    .eq('id', submissionId)

  if (updateError) {
    console.error('[curator/submissions/reject] update error', updateError)
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: 'Failed to reject submission' } },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    data: {
      id: submissionId,
      status: 'rejected',
      reviewer_comment: comment,
      reviewed_at: reviewedAt,
    },
  })
}
