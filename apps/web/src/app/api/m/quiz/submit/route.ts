import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import { BLOCK_QUIZ_PASS_PCT, MAX_QUIZ_ATTEMPTS, LOCK_DURATION_HOURS } from '@/lib/ai/constants'
import {
  checkSingleOrMulti,
  checkFreeText,
  type AnswerInput,
  type QuestionRow,
} from '@/lib/quiz/check'
import type { Database } from '../../../../../../../../packages/supabase/src/types'
import { isBlockUnlocked } from '@/lib/access/block-gate'

type BlockProgressUpdate =
  Database['public']['Tables']['student_block_progress']['Update']

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

interface SubmitBody {
  initData?: string
  block_id?: unknown
  answers?: unknown
}

function isValidAnswers(v: unknown): v is AnswerInput[] {
  if (!Array.isArray(v) || v.length === 0) return false
  return v.every(
    (a) =>
      a !== null &&
      typeof a === 'object' &&
      typeof (a as Record<string, unknown>).question_id === 'string',
  )
}

export async function POST(req: NextRequest) {
  // 1. Parse + validate body
  const body = (await req.json().catch(() => ({}))) as SubmitBody

  const initData = body.initData ?? ''
  const blockId = typeof body.block_id === 'number' ? body.block_id : parseInt(String(body.block_id ?? ''), 10)
  const answers = body.answers

  if (!Number.isFinite(blockId) || blockId < 1) {
    return err('Invalid block_id', 'BAD_BLOCK_ID', 400)
  }
  if (!isValidAnswers(answers)) {
    return err('answers must be a non-empty array of { question_id, selected_indices?, free_text? }', 'BAD_ANSWERS', 400)
  }

  // 2. Resolve user (Telegram initData OR dev-bypass)
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  // 3. Block-gate: проверяем, что блок разблокирован для этого пользователя
  if (!(await isBlockUnlocked(userId, blockId))) {
    return err('Этот блок ещё не открыт.', 'BLOCK_LOCKED', 403)
  }

  const supabase = createServiceSupabase()

  // Тестовый байпас: тестировщики (can_skip_block_lock) пересдают без лимита и без lock
  const { data: bypassProfile } = await supabase
    .from('profiles')
    .select('can_skip_block_lock')
    .eq('id', userId)
    .maybeSingle()
  const canSkip = Boolean((bypassProfile as { can_skip_block_lock?: boolean } | null)?.can_skip_block_lock)

  // 4. Read or create student_block_progress
  let { data: progress } = await supabase
    .from('student_block_progress')
    .select('id, quiz_attempts, quiz_locked_until, quiz_passed_at, status')
    .eq('user_id', userId)
    .eq('block_id', blockId)
    .maybeSingle()

  if (!progress) {
    const { data: created, error: createErr } = await supabase
      .from('student_block_progress')
      .insert({ user_id: userId, block_id: blockId })
      .select('id, quiz_attempts, quiz_locked_until, quiz_passed_at, status')
      .single()
    if (createErr || !created) {
      console.error('[quiz/submit] create progress error:', createErr)
      return err('Failed to initialise progress', 'DB_ERROR', 500)
    }
    progress = created
  }

  // 5. Guard: already passed?
  if (progress.quiz_passed_at) {
    return NextResponse.json({ error: { code: 'ALREADY_PASSED', message: 'Quiz already passed' } }, { status: 409 })
  }

  // 6. Guard: currently locked? (тестировщики не блокируются)
  if (!canSkip && progress.quiz_locked_until) {
    const lockedUntil = new Date(progress.quiz_locked_until)
    if (lockedUntil > new Date()) {
      return NextResponse.json(
        { error: { code: 'LOCKED', message: 'Quiz is locked', unlock_at: lockedUntil.toISOString() } },
        { status: 423 },
      )
    }
  }

  // 7. Load all questions with sensitive fields
  const { data: questions, error: qErr } = await supabase
    .from('block_quiz_questions')
    .select('id, question_text, question_type, options, order_index, correct_indices, expected_answer, rubric')
    .eq('block_id', blockId)
    .eq('is_mid_exam', false)
    .eq('is_final_exam', false)
    .order('order_index', { ascending: true })

  if (qErr || !questions || questions.length === 0) {
    console.error('[quiz/submit] questions fetch error:', qErr)
    return err('Failed to load questions', 'DB_ERROR', 500)
  }

  // Build lookup map
  const questionMap = new Map<string, QuestionRow>(questions.map((q) => [q.id, q as QuestionRow]))

  // 8. Check each submitted answer
  const results = await Promise.all(
    answers.map(async (answer) => {
      const question = questionMap.get(answer.question_id)
      if (!question) {
        return {
          question_id: answer.question_id,
          correct: false,
          your_answer: null,
          correct_answer: null,
          ai_comment: 'Unknown question',
        }
      }
      if (question.question_type === 'free_text') {
        return checkFreeText(question, answer, userId)
      }
      return checkSingleOrMulti(question, answer)
    }),
  )

  // 9. Compute score
  const correctCount = results.filter((r) => r.correct).length
  const totalCount = questions.length
  const scorePct = Math.round((correctCount / totalCount) * 100)
  const passed = scorePct >= BLOCK_QUIZ_PASS_PCT

  // First ai_call_id from free_text answers (for audit)
  const firstAiCallId = results.find((r) => r.ai_call_id != null)?.ai_call_id ?? null

  // 10. Insert attempt
  // JSON round-trip converts CheckResult[] → Json (satisfies Supabase Json type)
  const answersJson = JSON.parse(JSON.stringify(results)) as Database['public']['Tables']['student_quiz_attempts']['Insert']['answers']

  const { error: insertErr } = await supabase.from('student_quiz_attempts').insert({
    user_id: userId,
    block_id: blockId,
    exam_type: null,
    score_pct: scorePct,
    passed,
    answers: answersJson,
    ai_call_id: firstAiCallId,
  })
  if (insertErr) {
    console.error('[quiz/submit] insert attempt error:', insertErr)
    return err('Failed to save attempt', 'DB_ERROR', 500)
  }

  // 11. Update student_block_progress
  const currentAttempts = progress.quiz_attempts ?? 0
  const newAttempts = currentAttempts + 1
  // Тестировщики: попытки не исчерпываются, lock не ставится
  const exhausted = !canSkip && newAttempts >= MAX_QUIZ_ATTEMPTS && !passed

  const lockUntil = exhausted
    ? new Date(Date.now() + LOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString()
    : null

  const progressUpdate: BlockProgressUpdate = {
    last_quiz_score_pct: scorePct,
    quiz_attempts: exhausted ? 0 : newAttempts,
    ...(passed ? { quiz_passed_at: new Date().toISOString(), status: 'quiz_passed' } : {}),
    ...(exhausted && lockUntil ? { quiz_locked_until: lockUntil } : {}),
  }

  const { error: updateErr } = await supabase
    .from('student_block_progress')
    .update(progressUpdate)
    .eq('id', progress.id)

  if (updateErr) {
    console.error('[quiz/submit] update progress error:', updateErr)
    // Non-fatal: attempt already logged, return result anyway
  }

  // 12. Compute response values
  const attemptsUsed = exhausted ? 0 : newAttempts
  const attemptsRemaining = passed ? 0 : Math.max(0, MAX_QUIZ_ATTEMPTS - attemptsUsed)

  return NextResponse.json({
    ok: true,
    score_pct: scorePct,
    passed,
    attempts_used: attemptsUsed,
    attempts_remaining: attemptsRemaining,
    locked_until: lockUntil,
    results: results.map((r) => ({
      question_id: r.question_id,
      correct: r.correct,
      your_answer: r.your_answer,
      correct_answer: r.correct_answer,
      ...(r.ai_comment !== undefined ? { ai_comment: r.ai_comment } : {}),
    })),
  })
}
