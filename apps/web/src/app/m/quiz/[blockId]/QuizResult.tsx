'use client'

import Link from 'next/link'
import { type QuizSubmitResponse } from './useQuiz'
import { type QuizQuestionData } from './QuizQuestion'

interface Props {
  result: QuizSubmitResponse
  questions: QuizQuestionData[]
  blockId: number
  onRetry: () => void
}

function formatLockedUntil(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function QuizResult({ result, questions, blockId, onRetry }: Props) {
  const { score_pct, passed, attempts_remaining, locked_until, results } = result
  const isLocked = locked_until !== null && locked_until !== undefined

  return (
    <div>
      {/* Score */}
      <div className="quiz-card quiz-result__score-wrap">
        <div className={`quiz-result__score${passed ? '' : ' quiz-result__score--fail'}`}>
          {score_pct}%
        </div>
        <div className={`quiz-result__status${passed ? ' quiz-result__status--pass' : ' quiz-result__status--fail'}`}>
          {passed ? 'Тест сдан!' : 'Не сдано'}
        </div>
        {!passed && !isLocked && attempts_remaining > 0 && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--tg-hint, #9CA3AF)', marginTop: '0.5rem' }}>
            Осталось попыток: {attempts_remaining}
          </p>
        )}
        {isLocked && locked_until && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--tg-destructive, #EF4444)', marginTop: '0.5rem' }}>
            Следующая попытка: {formatLockedUntil(locked_until)}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="quiz-result__actions">
        {passed && (
          <>
            <Link href="/m/dashboard" className="quiz-button" style={{ textAlign: 'center' }}>
              К списку блоков
            </Link>
            <div className="quiz-result__next-hint">
              <strong>Дальше — местописания.</strong> Этап откроется в ближайшее время.
              Пока вернитесь к списку блоков.
            </div>
          </>
        )}
        {!passed && !isLocked && attempts_remaining > 0 && (
          <button type="button" className="quiz-button" onClick={onRetry}>
            Попробовать снова
          </button>
        )}
        {!passed && isLocked && (
          <Link href={`/m/lesson/${blockId}`} className="quiz-button quiz-button--ghost" style={{ textAlign: 'center' }}>
            Вернуться к конспекту
          </Link>
        )}
      </div>

      {/* Per-question breakdown */}
      {results.length > 0 && (
        <div style={{ marginTop: '1.25rem' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--tg-hint, #9CA3AF)', marginBottom: '0.625rem' }}>
            Разбор ответов
          </p>
          {results.map((r) => {
            const q = questions.find((q) => q.id === r.question_id)
            return (
              <div key={r.question_id} className={`quiz-card quiz-q-result quiz-q-result--${r.correct ? 'pass' : 'fail'}`}>
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
                    <strong className="quiz-q-result__feedback-label">Комментарий преподавателя</strong>
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
