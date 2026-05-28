'use client'

import { useEffect, useMemo, useState } from 'react'
import { shuffle, type TrainerVerse } from './types'

const clean = (t: string) => t.replace(/[^\p{L}\p{N}-]/gu, '')

// Сколько слов прятать в зависимости от длины стиха (1–3)
function blankCount(candidates: number): number {
  if (candidates <= 2) return 1
  if (candidates <= 6) return 2
  return 3
}

// Пропущенные слова: в стихе прячется несколько случайных слов, нужно
// по очереди выбрать их из вариантов. Слова и их число меняются каждый заход.
export function ClozeExercise({ verses }: { verses: TrainerVerse[] }) {
  const [index, setIndex] = useState(0)
  const [filled, setFilled] = useState(0)
  const [consumed, setConsumed] = useState<Set<number>>(new Set())
  const [wrongKey, setWrongKey] = useState<number | null>(null)

  useEffect(() => {
    setIndex(0)
  }, [verses])

  const verse = verses[Math.min(index, verses.length - 1)]

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

  const task = useMemo(() => {
    if (!verse) return null
    const tokens = verse.exact_text.split(/\s+/)
    const candidates = tokens
      .map((t, i) => ({ i, c: clean(t) }))
      .filter((x) => x.c.length >= 4)
    if (candidates.length === 0) return null

    const k = blankCount(candidates.length)
    const blanks = shuffle(candidates)
      .slice(0, k)
      .sort((a, b) => a.i - b.i)
    const correctWords = blanks.map((b) => b.c)
    const distractorsNeeded = Math.max(4 - k, 3)
    const distractors = shuffle(
      wordPool.filter((w) => !correctWords.some((c) => c.toLowerCase() === w.toLowerCase())),
    ).slice(0, distractorsNeeded)
    const options = shuffle([...correctWords, ...distractors]).map((word, key) => ({ key, word }))
    return { tokens, blankIndices: blanks.map((b) => b.i), correctWords, options }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verse?.id, wordPool])

  // Сброс прогресса задачи при смене стиха/задачи
  useEffect(() => {
    setFilled(0)
    setConsumed(new Set())
    setWrongKey(null)
  }, [task])

  if (!verse || !task) return null

  const allDone = filled >= task.correctWords.length
  const blankPos = (tokenIndex: number) => task.blankIndices.indexOf(tokenIndex)

  const pick = (key: number, word: string) => {
    if (allDone || consumed.has(key)) return
    const expected = task.correctWords[filled]
    if (word.toLowerCase() === expected.toLowerCase()) {
      setConsumed((s) => new Set(s).add(key))
      setFilled((f) => f + 1)
      setWrongKey(null)
    } else {
      setWrongKey(key)
    }
  }

  const goto = (delta: number) =>
    setIndex((i) => Math.max(0, Math.min(verses.length - 1, i + delta)))

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
          {task.tokens.map((tok, i) => {
            const pos = blankPos(i)
            if (pos === -1) return <span key={i}>{i === 0 ? tok : ' ' + tok}</span>
            const done = pos < filled
            const active = pos === filled
            return (
              <span key={i}>
                {i === 0 ? '' : ' '}
                <span
                  className={`tq-blank${done ? ' tq-blank--filled' : ''}`}
                  style={active ? { background: 'color-mix(in srgb, var(--accent-solid) 12%, transparent)' } : undefined}
                >
                  {done ? task.correctWords[pos] : '___'}
                </span>
              </span>
            )
          })}
        </p>

        <p className="tq-prompt">
          {allDone
            ? 'Готово! Все слова на месте ✓'
            : `Выбери пропущенные слова по порядку (${filled}/${task.correctWords.length})`}
        </p>
        <div className="tq-options">
          {task.options.map(({ key, word }) => {
            const isConsumed = consumed.has(key)
            const state = isConsumed
              ? ' tq-option--correct'
              : wrongKey === key
                ? ' tq-option--wrong'
                : ''
            return (
              <button
                key={key}
                type="button"
                className={`tq-option${state}`}
                onClick={() => pick(key, word)}
                disabled={isConsumed}
              >
                {word}
              </button>
            )
          })}
        </div>
      </div>

      <div className="trainer-nav">
        <button type="button" className="trainer-btn" onClick={() => goto(-1)} disabled={index === 0}>
          Назад
        </button>
        <button
          type="button"
          className="trainer-btn trainer-btn--primary"
          onClick={() => goto(1)}
          disabled={index >= verses.length - 1}
        >
          Дальше
        </button>
      </div>
    </>
  )
}
