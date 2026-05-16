import { NextRequest, NextResponse } from 'next/server'
import { resolveUserId } from '@/lib/telegram/resolve-user'
import { createServiceSupabase } from '@/lib/supabase-service'
import {
  MAX_QUIZ_ATTEMPTS,
  LOCK_DURATION_HOURS,
  MID_EXAM_PASS_PCT,
  FINAL_EXAM_PASS_PCT,
} from '@/lib/ai/constants'
import {
  checkSingleOrMulti,
  checkFreeText,
  type AnswerInput,
  type QuestionRow,
} from '@/lib/quiz/check'
import type { Database } from '../../../../../../../../packages/supabase/src/types'

type ExamProgressUpdate =
  Database['public']['Tables']['student_exam_progress']['Update']

export const dynamic = 'force-dynamic'

function err(message: string, code: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status })
}

interface SubmitBody {
  initData?: string
  type?: unknown
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
  const type = body.type
  const answers = body.answers

  if (type !== 'mid' && type !== 'final') {
    return err('type must be "mid" or "final"', 'BAD_EXAM_TYPE', 400)
  }
  if (!isValidAnswers(answers)) {
    return err(
      'answers must be a non-empty array of { question_id, selected_indices?, free_text? }',
      'BAD_ANSWERS',
      400,
    )
  }

  // 2. Resolve user
  const auth = await resolveUserId(initData)
  if (!auth.ok) return err(auth.message, auth.code, auth.status)
  const userId = auth.userId

  const passPct = type === 'mid' ? MID_EXAM_PASS_PCT : FINAL_EXAM_PASS_PCT
  const supabase = createServiceSupabase()

  // 3. Read or create student_exam_progress
  let { data: progress } = await supabase
    .from('student_exam_progress')
    .select('id, attempts, exam_locked_until, passed_at, status')
    .eq('user_id', userId)
    .eq('exam_type', type)
    .maybeSingle()

  if (!progress) {
    const { data: created, error: createErr } = await supabase
      .from('student_exam_progress')
      .insert({ user_id: userId, exam_type: type })
      .select('id, attempts, exam_locked_until, passed_at, status')
      .single()
    if (createErr || !created) {
      console.error(`[exam/submit:${type}] create progress error:`, createErr)
      return err('Failed to initialise exam progress', 'DB_ERROR', 500)
    }
    progress = created
  }

  // 4. Guard: already passed?
  if (progress.passed_at) {
    return NextResponse.json(
      { error: { code: 'ALREADY_PASSED', message: 'Exam already passed' } },
      { status: 409 },
    )
  }

  // 5. Guard: currently locked?
  if (progress.exam_locked_until) {
    const lockedUntil = new Date(progress.exam_locked_until)
    if (lockedUntil > new Date()) {
      return NextResponse.json(
        {
          error: {
            code: 'LOCKED',
            message: 'Exam is locked',
            unlock_at: lockedUntil.toISOString(),
          },
        },
        { status: 423 },
      )
    }
  }

  // 6. Load all questions with sensitive fields
  const examFilter = type === 'mid' ? 'is_mid_exam' : 'is_final_exam'
  const { data: questions, error: qErr } = await supabase
    .from('block_quiz_questions')
    .select(
      'id, question_text, question_type, options, order_index, block_id, correct_indices, expected_answer, rubric',
    )
    .eq(examFilter, true)
    .order('block_id', { ascending: true })
    .order('order_index', { ascending: true })

  if (qErr || !questions || questions.length === 0) {
    console.error(`[exam/submit:${type}] questions fetch error:`, qErr)
    return err('Failed to load questions', 'DB_ERROR', 500)
  }

  const questionMap = new Map<string, QuestionRow>(
    questions.map((q) => [q.id, q as QuestionRow]),
  )

  // 7. Check each submitted answer
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
          ai_call_id: null as string | null | undefined,
        }
      }
      if (question.question_type === 'free_text') {
        return checkFreeText(question, answer, userId)
      }
      return checkSingleOrMulti(question, answer)
    }),
  )

  // 8. Compute score
  const correctCount = results.filter((r) => r.correct).length
  const totalCount = questions.length
  const scorePct = Math.round((correctCount / totalCount) * 100)
  const passed = scorePct >= passPct

  const firstAiCallId =
    results.find((r) => r.ai_call_id != null)?.ai_call_id ?? null

  // 9. Insert attempt
  const answersJson = JSON.parse(
    JSON.stringify(results),
  ) as Database['public']['Tables']['student_quiz_attempts']['Insert']['answers']

  const { error: insertErr } = await supabase
    .from('student_quiz_attempts')
    .insert({
      user_id: userId,
      block_id: null,
      exam_type: type,
      score_pct: scorePct,
      passed,
      answers: answersJson,
      ai_call_id: firstAiCallId,
    })
  if (insertErr) {
    console.error(`[exam/submit:${type}] insert attempt error:`, insertErr)
    return err('Failed to save attempt', 'DB_ERROR', 500)
  }

  // 10. Update student_exam_progress
  const currentAttempts = progress.attempts ?? 0
  const newAttempts = currentAttempts + 1
  const exhausted = newAttempts >= MAX_QUIZ_ATTEMPTS && !passed

  const lockUntil = exhausted
    ? new Date(Date.now() + LOCK_DURATION_HOURS * 60 * 60 * 1000).toISOString()
    : null

  const progressUpdate: ExamProgressUpdate = {
    last_score_pct: scorePct,
    attempts: exhausted ? 0 : newAttempts,
    ...(passed
      ? { passed_at: new Date().toISOString(), status: 'passed' }
      : {}),
    ...(exhausted && lockUntil ? { exam_locked_until: lockUntil } : {}),
  }

  const { error: updateErr } = await supabase
    .from('student_exam_progress')
    .update(progressUpdate)
    .eq('id', progress.id)

  if (updateErr) {
    console.error(`[exam/submit:${type}] update progress error:`, updateErr)
    // Non-fatal: attempt already logged, continue to return result
  }

  // 11. On final exam pass — complete course_progress and unlock next course
  if (type === 'final' && passed) {
    const now = new Date().toISOString()

    const { error: cpErr1 } = await supabase
      .from('course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: 1,
          status: 'completed',
          final_exam_passed_at: now,
          completed_at: now,
        },
        { onConflict: 'user_id,course_id' },
      )
    if (cpErr1) {
      console.error('[exam/submit:final] upsert course_progress(1) error:', cpErr1)
    }

    const { error: cpErr2 } = await supabase
      .from('course_progress')
      .upsert(
        {
          user_id: userId,
          course_id: 2,
          status: 'unlocked',
        },
        { onConflict: 'user_id,course_id' },
      )
    if (cpErr2) {
      console.error('[exam/submit:final] upsert course_progress(2) error:', cpErr2)
    }
  }

  // 12. Build response
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
