'use client'

import { useEffect, useMemo, useState } from 'react'
import { shuffle, type TrainerVerse } from './types'

const clean = (t: string) => t.replace(/[^\p{L}\p{N}-]/gu, '')

// Пропущенное слово: в стихе прячется одно ключевое слово, нужно выбрать его
// из вариантов (правильное + отвлекающие из других стихов).
export function ClozeExercise({ verses }: { verses: TrainerVerse[] }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    setIndex(0)
    setPicked(null)
  }, [verses])

  // Пул слов-отвлекалок из всех стихов набора
  const wordPool = useMemo(() => {
    const set = new Set<string>()
    for (const v of verses) {
      for (const w of v.exact_text.split(/\s+/)) {
        const c = clean(w)
        if (c.length >= 4) set.add(c)
      }
    }
    return [...set]
  }, [verses])

  const verse = verses[Math.min(index, verses.length - 1)]

  const task = useMemo(() => {
    if (!verse) return null
    const tokens = verse.exact_text.split(/\s+/)
    const candidates = tokens
      .map((t, i) => ({ i, c: clean(t) }))
      .filter((x) => x.c.length >= 4)
    if (candidates.length === 0) return null
    // самое длинное слово — самое осмысленное для пропуска
    const blank = candidates.reduce((a, b) => (b.c.length > a.c.length ? b : a))
    const correct = blank.c
    const distractors = shuffle(
      wordPool.filter((w) => w.toLowerCase() !== correct.toLowerCase()),
    ).slice(0, 3)
    const options = shuffle([correct, ...distractors])
    return { tokens, blankIndex: blank.i, correct, options }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse?.id, wordPool])

  if (!verse) return null
  if (!task) {
    // Нечего прятать — просто показываем стих и даём листать
    return (
      <SkipCard
        index={index}
        total={verses.length}
        text={verse.exact_text}
        onPrev={() => setIndex((i) => Math.max(0, i - 1))}
        onNext={() => {
          setPicked(null)
          setIndex((i) => Math.min(verses.length - 1, i + 1))
        }}
      />
    )
  }

  const isCorrect = picked != null && picked.toLowerCase() === task.correct.toLowerCase()

  return (
    <>
      <div className="trainer-progress">
        <span>
          {index + 1} / {verses.length}
        </span>
        <span>{verse.reference}</span>
      </div>

      <div className="trainer-card">
        <p className="tq-text">
          {task.tokens.map((tok, i) =>
            i === task.blankIndex ? (
              <span key={i} className={`tq-blank${isCorrect ? ' tq-blank--filled' : ''}`}>
                {isCorrect ? task.correct : '___'}
              </span>
            ) : (
              <span key={i}>{i === 0 ? tok : ' ' + tok}</span>
            ),
          )}
        </p>

        <p className="tq-prompt">Выбери пропущенное слово</p>
        <div className="tq-options">
          {task.options.map((opt) => {
            const state =
              picked == null
                ? ''
                : opt === picked && isCorrect
                  ? ' tq-option--correct'
                  : opt === picked
                    ? ' tq-option--wrong'
                    : opt.toLowerCase() === task.correct.toLowerCase() && picked != null
                      ? ' tq-option--correct'
                      : ''
            return (
              <button
                key={opt}
                type="button"
                className={`tq-option${state}`}
                onClick={() => !isCorrect && setPicked(opt)}
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      <div className="trainer-nav">
        <button
          type="button"
          className="trainer-btn"
          onClick={() => {
            setPicked(null)
            setIndex((i) => Math.max(0, i - 1))
          }}
          disabled={index === 0}
        >
          Назад
        </button>
        <button
          type="button"
          className="trainer-btn trainer-btn--primary"
          onClick={() => {
            setPicked(null)
            setIndex((i) => Math.min(verses.length - 1, i + 1))
          }}
          disabled={index >= verses.length - 1}
        >
          Дальше
        </button>
      </div>
    </>
  )
}

function SkipCard({
  index,
  total,
  text,
  onPrev,
  onNext,
}: {
  index: number
  total: number
  text: string
  onPrev: () => void
  onNext: () => void
}) {
  return (
    <>
      <div className="trainer-progress">
        <span>
          {index + 1} / {total}
        </span>
      </div>
      <div className="trainer-card">
        <p className="tq-text">{text}</p>
      </div>
      <div className="trainer-nav">
        <button type="button" className="trainer-btn" onClick={onPrev} disabled={index === 0}>
          Назад
        </button>
        <button
          type="button"
          className="trainer-btn trainer-btn--primary"
          onClick={onNext}
          disabled={index >= total - 1}
        >
          Дальше
        </button>
      </div>
    </>
  )
}
