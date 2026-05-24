import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { MAX_QUIZ_ATTEMPTS } from '@/lib/ai/constants'

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

interface Params {
  params: Promise<{ blockId: string }>
}

export async function POST(req: NextRequest, { params }: Params) {
  // 1. Parse body
  const body = (await req.json().catch(() => ({}))) as { initData?: string }
  const initData = body.initData ?? ''

  // 2. Resolve user (Telegram initData OR dev-bypass)
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  // 3. Resolve blockId
  const { blockId: blockIdRaw } = await params
  const blockId = parseInt(blockIdRaw, 10)
  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('Invalid block id', 'BAD_BLOCK_ID', 400)
  }

  const supabase = createServiceSupabase()

  // Тестовый байпас: тестировщики не видят lock
  const { data: bypassProfile } = await supabase
    .from('profiles')
    .select('can_skip_block_lock')
    .eq('id', userId)
    .maybeSingle()
  const canSkip = Boolean((bypassProfile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)

  // 5. Read student_block_progress
  const { data: progress } = await supabase
    .from('student_block_progress')
    .select(
      'quiz_attempts, quiz_locked_until, quiz_passed_at, last_quiz_score_pct',
    )
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .maybeSingle()

  const attemptsUsed = progress?.quiz_attempts ?? 0
  const attemptsRemaining = Math.max(0, MAX_QUIZ_ATTEMPTS - attemptsUsed)

  // Locked?
  if (!canSkip && progress?.quiz_locked_until) {
    const lockedUntil = new Date(progress.quiz_locked_until)
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

  // Already passed?
  if (progress?.quiz_passed_at) {
    return NextResponse.json({
      ok: true,
      already_passed: true,
      score_pct: progress.last_quiz_score_pct,
    })
  }

  // 6. Load questions — strip sensitive fields
  const { data: questions, error: qErr } = await supabase
    .from('block_quiz_questions')
    .select('id, question_text, question_type, options, order_index')
    .eq('block_id', blockId)
    .eq('is_mid_exam', false)
    .eq('is_final_exam', false)
    .order('order_index', { ascending: true })

  if (qErr) {
    console.error('[quiz/get] questions fetch error:', qErr)
    return err('Failed to load questions', 'DB_ERROR', 500)
  }

  if (!questions || questions.length === 0) {
    return err('No questions found for this block', 'NO_QUESTIONS', 404)
  }

  return NextResponse.json({
    ok: true,
    questions,
    attempts_used: attemptsUsed,
    attempts_remaining: attemptsRemaining,
  })
}
