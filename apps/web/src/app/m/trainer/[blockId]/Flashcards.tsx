'use client'

import { useEffect, useState } from 'react'
import { FavStar } from './FavStar'
import type { TrainerVerse } from './types'

// Карточки-переворот: лицо — ссылка, оборот — текст стиха (и наоборот).
export function Flashcards({ verses }: { verses: TrainerVerse[] }) {
  const [index, setIndex] = useState(0)
  const [flipped, setFlipped] = useState(false)

  // При смене набора стихов — сброс на начало
  useEffect(() => {
    setIndex(0)
    setFlipped(false)
  }, [verses])

  if (verses.length === 0) return null
  const verse = verses[Math.min(index, verses.length - 1)]

  const go = (delta: number) => {
    setFlipped(false)
    setIndex((i) => Math.max(0, Math.min(verses.length - 1, i + delta)))
  }

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

      <div className="trainer-card tc-flip" onClick={() => setFlipped((f) => !f)}>
        {flipped ? (
          <>
            <div className="tc-flip__eyebrow">Текст</div>
            <div className="tc-flip__text">{verse.exact_text}</div>
          </>
        ) : (
          <>
            <div className="tc-flip__eyebrow">Местописание</div>
            <div className="tc-flip__reference">{verse.reference}</div>
          </>
        )}
        <div className="tc-flip__hint">Нажми, чтобы перевернуть</div>
      </div>

      <div className="trainer-nav">
        <button
          type="button"
          className="trainer-btn"
          onClick={() => go(-1)}
          disabled={index === 0}
        >
          Назад
        </button>
        <button
          type="button"
          className="trainer-btn trainer-btn--primary"
          onClick={() => go(1)}
          disabled={index >= verses.length - 1}
        >
          Дальше
        </button>
      </div>
    </>
  )
}
