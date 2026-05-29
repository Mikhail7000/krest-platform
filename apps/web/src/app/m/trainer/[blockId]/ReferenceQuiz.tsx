'use client'

import { useEffect, useMemo, useState } from 'react'
import { FavStar } from './FavStar'
import { shuffle, type TrainerVerse } from './types'

// Викторина ссылок: показываем текст стиха — нужно выбрать правильное
// местописание (книга, глава:стих) из вариантов.
export function ReferenceQuiz({ verses }: { verses: TrainerVerse[] }) {
  const [index, setIndex] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  useEffect(() => {
    setIndex(0)
    setPicked(null)
  }, [verses])

  const allRefs = useMemo(
    () => [...new Set(verses.map((v) => v.reference))],
    [verses],
  )

  const verse = verses[Math.min(index, verses.length - 1)]

  const options = useMemo(() => {
    if (!verse) return []
    const distractors = shuffle(allRefs.filter((r) => r !== verse.reference)).slice(0, 3)
    return shuffle([verse.reference, ...distractors])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse?.id, allRefs])

  if (!verse) return null
  const isCorrect = picked === verse.reference

  return (
    <>
      <div className="trainer-progress">
        <span>
          {index + 1} / {verses.length}
        </span>
        <span className="trainer-progress__right">
          {verse.topic_label ?? ''}
          <FavStar verseId={verse.id} />
        </span>
      </div>

      <div className="trainer-card">
        <p className="tq-text">{verse.exact_text}</p>
        <p className="tq-prompt">Откуда этот стих?</p>
        <div className="tq-options">
          {options.map((opt) => {
            const state =
              picked == null
                ? ''
                : opt === verse.reference
                  ? ' tq-option--correct'
                  : opt === picked
                    ? ' tq-option--wrong'
                    : ''
            return (
              <button
                key={opt}
                type="button"
                className={`tq-option tq-option--ref${state}`}
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
