'use client'

import { QuizQuestion } from '../../quiz/[blockId]/QuizQuestion'
import { ExamResult } from './ExamResult'
import { useExam, isAnswered } from './useExam'

interface Props {
  examType: 'mid' | 'final'
}

function formatUnlockAt(iso: string): string {
  return new Date(iso).toLocaleString('ru-RU', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

export function ExamClient({ examType }: Props) {
  const {
    view, errorMsg, questions, answers, setAnswer,
    attemptsUsed, lockedUntil, alreadyPassedScore, submitResult,
    loadExam, submitExam, retryExam,
  } = useExam(examType)

  const allAnswered =
    questions.length > 0 && questions.every((q) => isAnswered(q, answers[q.id]))

  // ── no_tg ─────────────────────────────────────────────────────
  if (view === 'no_tg') {
    return (
      <div className="quiz-state-card">
        <p className="quiz-state-card__title">Откройте в Telegram</p>
        <p className="quiz-state-card__desc">
          Экзамен доступен только через Telegram-бота <strong>@cross_bot</strong>.
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
        <button type="button" className="quiz-button" onClick={loadExam}>
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
          {view === 'submitting' ? 'Проверяем ответы…' : 'Загружаем экзамен…'}
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
        <p className="quiz-state-card__title">Экзамен заблокирован</p>
        {lockedUntil && (
          <p className="quiz-locked-until">до {formatUnlockAt(lockedUntil)}</p>
        )}
        <p className="quiz-state-card__desc">
          Вы использовали {attemptsUsed} из 3 попыток. Вернитесь позже или
          повторите материал курса.
        </p>
      </div>
    )
  }

  // ── already_passed ─────────────────────────────────────────────
  if (view === 'already_passed') {
    return (
      <div className="quiz-state-card">
        <div className="quiz-passed-badge">Экзамен уже сдан</div>
        {alreadyPassedScore !== null && (
          <p className="quiz-result__score" style={{ textAlign: 'center' }}>
            {alreadyPassedScore}%
          </p>
        )}
        <p className="quiz-state-card__desc">
          Вы успешно сдали этот экзамен.
          {examType === 'final' && ' Курс «КРЕСТ» завершён.'}
          {examType === 'mid' && ' Блоки 6–10 открыты.'}
        </p>
      </div>
    )
  }

  // ── result ────────────────────────────────────────────────────
  if ((view === 'result_passed' || view === 'result_failed') && submitResult) {
    return (
      <ExamResult
        result={submitResult}
        questions={questions}
        examType={examType}
        onRetry={retryExam}
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
          audioAnswer={q.question_type === 'free_text'}
        />
      ))}

      <button
        type="button"
        className="exam-submit"
        disabled={!allAnswered}
        onClick={submitExam}
      >
        {allAnswered ? 'Сдать экзамен' : 'Ответьте на все вопросы'}
      </button>
    </div>
  )
}
