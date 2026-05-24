import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { MAX_QUIZ_ATTEMPTS, MID_EXAM_PASS_PCT, FINAL_EXAM_PASS_PCT } from '@/lib/ai/constants'

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

interface Params {
  params: Promise<{ type: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  // 1. Parse body and resolve user
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const initData = body.initData ?? ''

  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  // 2. Validate exam type
  const { type } = await params
  if (type !== 'mid' && type !== 'final') {
    return err('type must be "mid" or "final"', 'BAD_EXAM_TYPE', 400)
  }

  const passPct = type === 'mid' ? MID_EXAM_PASS_PCT : FINAL_EXAM_PASS_PCT
  const supabase = createServiceSupabase()

  // Тестовый байпас: тестировщики не видят lock
  const { data: bypassProfile } = await supabase
    .from('profiles')
    .select('can_skip_block_lock')
    .eq('id', userId)
    .maybeSingle()
  const canSkip = Boolean((bypassProfile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)

  // 3. Read student_exam_progress
  const { data: progress } = await supabase
    .from('student_exam_progress')
    .select('attempts, exam_locked_until, passed_at, last_score_pct')
    .eq('user_id', userId)
    .eq('exam_type', type)
    .maybeSingle()

  const attemptsUsed = progress?.attempts ?? 0
  const attemptsRemaining = Math.max(0, MAX_QUIZ_ATTEMPTS - attemptsUsed)

  // 4. Already passed?
  if (progress?.passed_at) {
    return NextResponse.json({
      ok: true,
      already_passed: true,
      score_pct: progress.last_score_pct,
    })
  }

  // 5. Locked? (тестировщики не блокируются)
  if (!canSkip && progress?.exam_locked_until) {
    const lockedUntil = new Date(progress.exam_locked_until)
    if (lockedUntil > new Date()) {
      return NextResponse.json(
        {
          locked: true,
          unlock_at: lockedUntil.toISOString(),
          attempts_used: attemptsUsed,
        },
        { status: 423 },
      )
    }
  }

  // 6. Load questions — strip sensitive fields
  const examFilter = type === 'mid' ? 'is_mid_exam' : 'is_final_exam'
  const { data: questions, error: qErr } = await supabase
    .from('block_quiz_questions')
    .select('id, question_text, question_type, options, order_index, block_id')
    .eq(examFilter, true)
    .order('block_id', { ascending: true })
    .order('order_index', { ascending: true })

  if (qErr) {
    console.error(`[exam/get:${type}] questions fetch error:`, qErr)
    return err('Failed to load questions', 'DB_ERROR', 500)
  }

  if (!questions || questions.length === 0) {
    return err('No questions found for this exam', 'NO_QUESTIONS', 404)
  }

  return NextResponse.json({
    ok: true,
    type,
    questions,
    attempts_used: attemptsUsed,
    attempts_remaining: attemptsRemaining,
    pass_pct: passPct,
  })
}
