'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { type ExamSubmitResponse } from './useExam'
import { type QuizQuestionData } from '../../quiz/[blockId]/QuizQuestion'

interface Props {
  result: ExamSubmitResponse
  questions: QuizQuestionData[]
  examType: 'mid' | 'final'
  onRetry: () => void
}

function formatLockedUntil(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function ExamResult({ result, questions, examType, onRetry }: Props) {
  const { score_pct, passed, attempts_remaining, locked_until, results } = result
  const isLocked = locked_until !== null && locked_until !== undefined
  const router = useRouter()

  // Final exam passed — auto-redirect to /m/completed after 5s
  useEffect(() => {
    if (examType === 'final' && passed) {
      const timer = setTimeout(() => router.push('/m/completed'), 5000)
      return () => clearTimeout(timer)
    }
  }, [examType, passed, router])

  return (
    <div>
      {/* Score card */}
      <div className="exam-result__score-wrap">
        <div className={`exam-result__score${passed ? '' : ' exam-result__score--fail'}`}>
          {score_pct}%
        </div>
        <div className={`exam-result__status${passed ? ' exam-result__status--pass' : ' exam-result__status--fail'}`}>
          {passed ? 'Экзамен сдан!' : 'Не сдано'}
        </div>
        {!passed && !isLocked && attempts_remaining > 0 && (
          <p className="exam-result__hint">Осталось попыток: {attempts_remaining}</p>
        )}
        {isLocked && locked_until && (
          <p className="exam-result__hint" style={{ color: 'var(--tg-destructive, #EF4444)' }}>
            Следующая попытка: {formatLockedUntil(locked_until)}
          </p>
        )}
        {examType === 'final' && passed && (
          <p className="exam-result__hint">Переход к поздравлению через 5 секунд…</p>
        )}
      </div>

      {/* Actions */}
      <div className="exam-result__actions">
        {passed && examType === 'final' && (
          <Link href="/m/completed" className="quiz-button" style={{ textAlign: 'center' }}>
            Перейти к поздравлению
          </Link>
        )}
        {passed && examType === 'mid' && (
          <>
            <Link href="/m/dashboard" className="quiz-button" style={{ textAlign: 'center' }}>
              К списку блоков
            </Link>
            <div className="quiz-result__next-hint">
              <strong>Промежуточный экзамен сдан.</strong> Блок 6 теперь доступен
              — продолжайте курс.
            </div>
          </>
        )}
        {!passed && !isLocked && attempts_remaining > 0 && (
          <button type="button" className="quiz-button" onClick={onRetry}>
            Попробовать снова
          </button>
        )}
        {!passed && (isLocked || attempts_remaining === 0) && (
          <Link href="/m/dashboard" className="quiz-button quiz-button--ghost" style={{ textAlign: 'center' }}>
            Вернуться к дашборду
          </Link>
        )}
      </div>

      {/* Per-question breakdown */}
      {results.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <p style={{
            fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: 'var(--tg-hint, #9CA3AF)', marginBottom: '0.625rem',
          }}>
            Разбор ответов
          </p>
          {results.map((r) => {
            const q = questions.find((item) => item.id === r.question_id)
            return (
              <div
                key={r.question_id}
                className={`quiz-card quiz-q-result quiz-q-result--${r.correct ? 'pass' : 'fail'}`}
              >
                <div className={`quiz-q-result__verdict quiz-q-result__verdict--${r.correct ? 'pass' : 'fail'}`}>
                  {r.correct ? '✓ Верно' : '✗ Неверно'}
                </div>
                {q && <p className="quiz-q-result__text">{q.question_text}</p>}
                <p className="quiz-q-result__answer-row">
                  Ваш ответ: <span>{r.your_answer}</span>
                </p>
                {!r.correct && (
                  <p className="quiz-q-result__answer-row">
                    Правильный: <span>{r.correct_answer}</span>
                  </p>
                )}
                {r.ai_comment && (
                  <div className="quiz-q-result__feedback">
                    <strong className="quiz-q-result__feedback-label">Комментарий</strong>
                    <p>{r.ai_comment}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
