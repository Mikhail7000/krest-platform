'use client'

import { QuizQuestion } from './QuizQuestion'
import { QuizResult } from './QuizResult'
import { useQuiz, isAnswered, type Answer, type QuizSubmitResponse } from './useQuiz'

// Re-export for consumers (QuizResult, QuizQuestion import from here)
export type { Answer, QuizSubmitResponse }

function formatUnlockAt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

interface Props {
  blockId: number
  blockTitle: string
}

export function QuizClient({ blockId }: Props) {
  const {
    view, errorMsg, questions, answers, setAnswer,
    attemptsUsed, lockedUntil, alreadyPassedScore, submitResult,
    loadQuiz, submitQuiz, retryQuiz,
  } = useQuiz(blockId)

  const allAnswered =
    questions.length > 0 && questions.every((q) => isAnswered(q, answers[q.id]))

  // ── no_tg ─────────────────────────────────────────────────────
  if (view === 'no_tg') {
    return (
      <div className="quiz-state-card">
        <p className="quiz-state-card__title">Откройте в Telegram</p>
        <p className="quiz-state-card__desc">
          Тест доступен только через Telegram-бота <strong>@cross_bot</strong>.
        </p>
      </div>
    )
  }

  // ── error ─────────────────────────────────────────────────────
  if (view === 'error') {
    return (
      <div className="quiz-state-card">
        <p className="quiz-state-card__title">Ошибка загрузки</p>
        <p className="quiz-state-card__desc">{errorMsg}</p>
        <button type="button" className="quiz-button" onClick={loadQuiz}>
          Попробовать снова
        </button>
      </div>
    )
  }

  // ── loading / submitting ───────────────────────────────────────
  if (view === 'loading' || view === 'submitting') {
    return (
      <>
        <p className="quiz-loading-hint">
          {view === 'submitting' ? 'Проверяем ответы…' : 'Загружаем тест…'}
        </p>
        {[1, 2, 3].map((n) => <div key={n} className="quiz-skeleton" />)}
      </>
    )
  }

  // ── locked ────────────────────────────────────────────────────
  if (view === 'locked') {
    return (
      <div className="quiz-state-card">
        <span className="quiz-locked-icon">🔒</span>
        <p className="quiz-state-card__title">Тест заблокирован</p>
        {lockedUntil && (
          <p className="quiz-locked-until">до {formatUnlockAt(lockedUntil)}</p>
        )}
        <p className="quiz-state-card__desc">
          Вы использовали {attemptsUsed} из 3 попыток. Возвращайтесь позже или
          ещё раз изучите конспект.
        </p>
      </div>
    )
  }

  // ── already_passed ─────────────────────────────────────────────
  if (view === 'already_passed') {
    return (
      <div className="quiz-state-card">
        <div className="quiz-passed-badge">Тест уже сдан</div>
        {alreadyPassedScore !== null && (
          <p className="quiz-result__score" style={{ textAlign: 'center' }}>
            {alreadyPassedScore}%
          </p>
        )}
        <p className="quiz-state-card__desc">
          Вы успешно прошли этот тест. Переходите к следующему этапу.
        </p>
      </div>
    )
  }

  // ── result ────────────────────────────────────────────────────
  if ((view === 'result_passed' || view === 'result_failed') && submitResult) {
    return (
      <QuizResult
        result={submitResult}
        questions={questions}
        blockId={blockId}
        onRetry={retryQuiz}
      />
    )
  }

  // ── idle: question list ───────────────────────────────────────
  return (
    <div>
      {attemptsUsed > 0 && (
        <span className="quiz-attempts">Попытка {attemptsUsed + 1} из 3</span>
      )}

      {questions.map((q, i) => (
        <QuizQuestion
          key={q.id}
          question={q}
          index={i}
          answer={answers[q.id]}
          onChange={setAnswer}
        />
      ))}

      <button
        type="button"
        className="quiz-submit"
        disabled={!allAnswered}
        onClick={submitQuiz}
      >
        {allAnswered ? 'Отправить ответы' : 'Ответьте на все вопросы'}
      </button>
    </div>
  )
}
