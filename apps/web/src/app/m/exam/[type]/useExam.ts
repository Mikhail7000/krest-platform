'use client'

import { useEffect, useState, useCallback } from 'react'
import { type QuizQuestionData } from '../../quiz/[blockId]/QuizQuestion'
import { type Answer } from '../../quiz/[blockId]/useQuiz'

export type { Answer }

export interface ExamSubmitResponse {
  score_pct: number
  passed: boolean
  attempts_used: number
  attempts_remaining: number
  locked_until: string | null
  results: Array<{
    question_id: string
    correct: boolean
    your_answer: string
    correct_answer: string
    ai_comment?: string
  }>
}

export type ExamViewState =
  | 'loading'
  | 'no_tg'
  | 'error'
  | 'idle'
  | 'submitting'
  | 'result_passed'
  | 'result_failed'
  | 'locked'
  | 'already_passed'

interface ExamLoadOk {
  ok: true
  type: string
  questions: QuizQuestionData[]
  attempts_used: number
  attempts_remaining: number
  pass_pct: number
}

interface ExamLoadLocked {
  locked: true
  unlock_at: string
  attempts_used: number
}

interface ExamLoadPassed {
  already_passed: true
  score_pct: number
}

type ExamLoadResponse = ExamLoadOk | ExamLoadLocked | ExamLoadPassed

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })
    ?.Telegram?.WebApp?.initData ?? ''
}

export function isAnswered(q: QuizQuestionData, a: Answer | undefined): boolean {
  if (!a) return false
  if (q.question_type === 'free_text') return (a.free_text?.length ?? 0) >= 20
  return (a.selected_indices?.length ?? 0) > 0
}

export function useExam(type: 'mid' | 'final') {
  const [view, setView] = useState<ExamViewState>('loading')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [questions, setQuestions] = useState<QuizQuestionData[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [attemptsUsed, setAttemptsUsed] = useState(0)
  const [attemptsRemaining, setAttemptsRemaining] = useState(3)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)
  const [alreadyPassedScore, setAlreadyPassedScore] = useState<number | null>(null)
  const [submitResult, setSubmitResult] = useState<ExamSubmitResponse | null>(null)

  const loadExam = useCallback(async () => {
    const initData = getInitData()
    setView('loading')
    setAnswers({})
    setSubmitResult(null)

    try {
      const res = await fetch(`/api/m/exam/${type}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData }),
      })

      if (res.status === 423) {
        const data = (await res.json()) as ExamLoadLocked
        setLockedUntil(data.unlock_at)
        setAttemptsUsed(data.attempts_used)
        setView('locked')
        return
      }

      if (res.status === 401) {
        setView('no_tg')
        return
      }

      if (!res.ok) {
        setErrorMsg(`Ошибка ${res.status}`)
        setView('error')
        return
      }

      const data = (await res.json()) as ExamLoadResponse

      if ('already_passed' in data && data.already_passed) {
        setAlreadyPassedScore(data.score_pct)
        setView('already_passed')
        return
      }

      if ('locked' in data && data.locked) {
        setLockedUntil((data as ExamLoadLocked).unlock_at)
        setAttemptsUsed((data as ExamLoadLocked).attempts_used)
        setView('locked')
        return
      }

      const ok = data as ExamLoadOk
      setQuestions(ok.questions)
      setAttemptsUsed(ok.attempts_used)
      setAttemptsRemaining(ok.attempts_remaining)
      setView('idle')
    } catch {
      setErrorMsg('Не удалось загрузить экзамен. Проверьте соединение.')
      setView('error')
    }
  }, [type])

  useEffect(() => { loadExam() }, [loadExam])

  async function submitExam() {
    const initData = getInitData()
    setView('submitting')
    const payload = {
      initData,
      type,
      answers: questions.map((q) => {
        const a = answers[q.id]
        return {
          question_id: q.id,
          ...(q.question_type !== 'free_text' ? { selected_indices: a?.selected_indices ?? [] } : {}),
          ...(q.question_type === 'free_text' ? { free_text: a?.free_text ?? '' } : {}),
        }
      }),
    }

    try {
      const res = await fetch('/api/m/exam/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        setErrorMsg(`Ошибка отправки ${res.status}`)
        setView('error')
        return
      }

      const data = (await res.json()) as ExamSubmitResponse
      setSubmitResult(data)
      setAttemptsUsed(data.attempts_used)
      setAttemptsRemaining(data.attempts_remaining)
      setLockedUntil(data.locked_until)
      setView(data.passed ? 'result_passed' : 'result_failed')
    } catch {
      setErrorMsg('Ошибка отправки. Попробуйте ещё раз.')
      setView('error')
    }
  }

  function retryExam() {
    setView('idle')
    setAnswers({})
    setSubmitResult(null)
  }

  function setAnswer(a: Answer) {
    setAnswers((prev) => ({ ...prev, [a.question_id]: a }))
  }

  return {
    view, errorMsg, questions, answers, setAnswer,
    attemptsUsed, attemptsRemaining, lockedUntil, alreadyPassedScore, submitResult,
    loadExam, submitExam, retryExam,
  }
}
