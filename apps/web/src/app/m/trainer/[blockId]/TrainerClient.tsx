'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Flashcards } from './Flashcards'
import { ClozeExercise } from './ClozeExercise'
import { ReferenceQuiz } from './ReferenceQuiz'
import { ReciteExercise } from './ReciteExercise'
import { useFavorites } from './useFavorites'
import type { TrainerData } from './types'

type Mode = 'cards' | 'cloze' | 'quiz' | 'recite'
type BlockFilter = number | 'all' | 'fav'

const MODES: { key: Mode; label: string }[] = [
  { key: 'cards', label: 'Карточки' },
  { key: 'cloze', label: 'Пропуски' },
  { key: 'quiz', label: 'Викторина' },
  { key: 'recite', label: 'Озвучить' },
]

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram
    ?.WebApp?.initData ?? ''
}

// ─── Баннер завершения тренажёра ─────────────────────────────────────────────

interface TrainerCompleteBannerProps {
  blockId: number
  initialPassedAt: string | null
}

function TrainerCompleteBanner({ blockId, initialPassedAt }: TrainerCompleteBannerProps) {
  const [passedAt, setPassedAt] = useState<string | null>(initialPassedAt)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleComplete() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`/api/m/trainer/${blockId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: getInitData() }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: { message: string } }
      if (json.ok) {
        setPassedAt(new Date().toISOString())
      } else {
        setError(json.error?.message ?? 'Ошибка сохранения')
      }
    } catch {
      setError('Нет соединения')
    } finally {
      setPending(false)
    }
  }

  if (passedAt) {
    return (
      <div className="trainer-complete-banner trainer-complete-banner--done">
        <span className="trainer-complete-banner__icon">✓</span>
        <span className="trainer-complete-banner__text">Тренажёр пройден</span>
      </div>
    )
  }

  return (
    <div className="trainer-complete-banner">
      <p className="trainer-complete-banner__hint">
        Выучил все местописания? Отметь тренажёр пройденным — это одно из условий завершения блока.
      </p>
      {error && <p className="trainer-complete-banner__error">{error}</p>}
      <button
        type="button"
        className="trainer-complete-btn"
        onClick={handleComplete}
        disabled={pending}
      >
        {pending ? 'Сохраняем…' : 'Я выучил местописания'}
      </button>
    </div>
  )
}

// ─── Главный компонент ───────────────────────────────────────────────────────

export function TrainerClient({ blockId }: { blockId: number }) {
  const [data, setData] = useState<TrainerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<BlockFilter>(blockId)
  const [mode, setMode] = useState<Mode>('cards')
  const { isFav, ids } = useFavorites()
  const favKey = ids.slice().sort().join(',')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/m/trainer/${blockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TrainerData | null) => {
        if (!cancelled && d?.ok) setData(d)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [blockId])

  const verses = useMemo(() => {
    if (!data) return []
    if (filter === 'fav') return data.verses.filter((v) => isFav(v.id))
    if (filter === 'all') return data.verses
    return data.verses.filter((v) => v.block_id === filter)
    // favKey влияет ТОЛЬКО на фильтр «Избранное». В обычных блоках добавление
    // в избранное не должно пересобирать список (иначе карточка сбрасывается).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, filter, filter === 'fav' ? favKey : ''])

  if (loading) {
    return (
      <div className="miniapp-container trainer-page">
        <p className="trainer-empty">Загружаем тренажёр…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="miniapp-container trainer-page">
        <Link href={`/m/lesson/${blockId}`} className="trainer-back">
          ‹ К уроку
        </Link>
        <p className="trainer-empty">Не удалось загрузить местописания. Попробуйте позже.</p>
      </div>
    )
  }

  const multiBlock = data.blocks.length > 1

  return (
    <div className="miniapp-container trainer-page">
      <Link href={`/m/lesson/${blockId}`} className="trainer-back">
        ‹ К уроку
      </Link>

      <header className="trainer-header">
        <h1 className="trainer-header__title">Тренажёр местописаний</h1>
        <p className="trainer-header__subtitle">Выучи стихи перед сдачей блока</p>
      </header>

      {/* Баннер завершения — только для текущего блока */}
      <TrainerCompleteBanner
        blockId={blockId}
        initialPassedAt={data.trainer_passed_at}
      />

      <div className="trainer-chips">
        {data.blocks.map((b) => (
          <button
            key={b.id}
            type="button"
            className={`trainer-chip${filter === b.id ? ' trainer-chip--active' : ''}`}
            onClick={() => setFilter(b.id)}
          >
            Блок {b.order_num}
          </button>
        ))}
        {multiBlock && (
          <button
            type="button"
            className={`trainer-chip${filter === 'all' ? ' trainer-chip--active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
        )}
        <button
          type="button"
          className={`trainer-chip${filter === 'fav' ? ' trainer-chip--active' : ''}`}
          onClick={() => setFilter('fav')}
        >
          ★ Избранное
        </button>
      </div>

      <div className="trainer-modes">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`trainer-mode${mode === m.key ? ' trainer-mode--active' : ''}`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {verses.length === 0 ? (
        <p className="trainer-empty">
          {filter === 'fav'
            ? 'В избранном пока пусто. Отметь стихи звёздочкой ☆ — и они появятся здесь.'
            : 'В этом блоке пока нет местописаний для тренировки.'}
        </p>
      ) : mode === 'cards' ? (
        <Flashcards key={`cards-${filter}`} verses={verses} />
      ) : mode === 'cloze' ? (
        <ClozeExercise key={`cloze-${filter}`} verses={verses} />
      ) : mode === 'quiz' ? (
        <ReferenceQuiz key={`quiz-${filter}`} verses={verses} />
      ) : (
        <ReciteExercise key={`recite-${filter}`} verses={verses} />
      )}
    </div>
  )
}
