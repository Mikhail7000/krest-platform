'use client'

import { type Answer } from './useQuiz'
import { AudioAnswer } from '../../exam/[type]/AudioAnswer'

export interface QuizQuestionData {
  id: string
  question_text: string
  question_type: 'single_choice' | 'multi_choice' | 'free_text'
  options: string[] | null
  order_index: number
  // В экзамене — название блока вопроса (показываем вместо «Блок N»)
  block_title?: string | null
}

interface Props {
  question: QuizQuestionData
  index: number
  answer: Answer | undefined
  onChange: (answer: Answer) => void
  // В экзаменах развёрнутый ответ записывается голосом (аудио → транскрипт)
  audioAnswer?: boolean
}

export function QuizQuestion({ question, index, answer, onChange, audioAnswer }: Props) {
  const { id, question_text, question_type, options } = question

  function toggleSingle(optionIndex: number) {
    onChange({ question_id: id, selected_indices: [optionIndex] })
  }

  function toggleMulti(optionIndex: number) {
    const current = answer?.selected_indices ?? []
    const next = current.includes(optionIndex)
      ? current.filter((i) => i !== optionIndex)
      : [...current, optionIndex]
    onChange({ question_id: id, selected_indices: next })
  }

  function onFreeText(text: string) {
    onChange({ question_id: id, free_text: text })
  }

  const selectedIndices = answer?.selected_indices ?? []
  const freeText = answer?.free_text ?? ''
  const charOk = freeText.length >= 20

  return (
    <section className="quiz-card">
      {question.block_title && <span className="quiz-question__block">{question.block_title}</span>}
      <span className="quiz-question__label">Вопрос {index + 1}</span>
      <p className="quiz-question__text">{question_text}</p>

      {question_type === 'single_choice' && options && (
        <div className="quiz-options" role="radiogroup">
          {options.map((opt, i) => {
            const selected = selectedIndices.includes(i)
            return (
              <button
                key={i}
                type="button"
                className={`quiz-option${selected ? ' quiz-option--selected' : ''}`}
                onClick={() => toggleSingle(i)}
              >
                <span className="quiz-option__mark">
                  {selected && <span className="quiz-option__mark-inner" />}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {question_type === 'multi_choice' && options && (
        <div className="quiz-options" role="group">
          {options.map((opt, i) => {
            const selected = selectedIndices.includes(i)
            return (
              <button
                key={i}
                type="button"
                className={`quiz-option${selected ? ' quiz-option--selected' : ''}`}
                onClick={() => toggleMulti(i)}
              >
                <span className="quiz-option__mark quiz-option__mark--checkbox">
                  {selected && <span className="quiz-option__check">✓</span>}
                </span>
                {opt}
              </button>
            )
          })}
        </div>
      )}

      {question_type === 'free_text' && audioAnswer && (
        <AudioAnswer currentText={freeText} onTranscript={onFreeText} />
      )}

      {question_type === 'free_text' && !audioAnswer && (
        <>
          <textarea
            className="quiz-textarea"
            placeholder="Напишите ваш ответ…"
            value={freeText}
            onChange={(e) => onFreeText(e.target.value)}
            rows={4}
          />
          <p className={`quiz-char-hint${charOk ? '' : ' quiz-char-hint--warn'}`}>
            {freeText.length < 20
              ? `Минимум 20 символов (ещё ${20 - freeText.length})`
              : `${freeText.length} символов`}
          </p>
        </>
      )}
    </section>
  )
}
