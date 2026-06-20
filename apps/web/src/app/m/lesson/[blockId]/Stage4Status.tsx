'use client'

/**
 * Stage4Status — клиентский компонент трекинга практики блока (дневная модель).
 * Фетчит /api/m/block-status/[blockId] и отображает:
 * - Сводку «Закрыто дней N/7»
 * - Бейджи статуса «сегодня» на дневных карточках (cross_photo, prayer, trainer)
 * - Бейджи разовых пунктов (quiz, friday) — всегда
 * - Местописания (recitationAudio, recitationVideo) — дневные
 */

import { useEffect, useReducer } from 'react'

// ─── Типы ───────────────────────────────────────────────────────────────────

interface TodayStatus {
  cross: boolean
  prayer: boolean
  recitationAudio: boolean
  recitationVideo: boolean
  trainer: boolean
}

interface BlockStatus {
  closedDays: number
  target: number
  today: TodayStatus
  quiz: boolean
  friday: boolean
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'done'; status: BlockStatus }
  | { phase: 'error' }

type Action =
  | { type: 'FETCH' }
  | { type: 'OK'; status: BlockStatus }
  | { type: 'FAIL' }

function reducer(_: State, action: Action): State {
  switch (action.type) {
    case 'FETCH':
      return { phase: 'loading' }
    case 'OK':
      return { phase: 'done', status: action.status }
    case 'FAIL':
      return { phase: 'error' }
  }
}

function getInitData(): string {
  if (typeof window === 'undefined') return ''
  return (
    (window as unknown as { Telegram?: { WebApp?: { initData?: string } } })?.Telegram?.WebApp
      ?.initData ?? ''
  )
}

// ─── Мини-сводка «Дней N/7» ─────────────────────────────────────────────────

function SummaryBar({ closedDays, target }: { closedDays: number; target: number }) {
  const pct = target > 0 ? Math.round((Math.min(closedDays, target) / target) * 100) : 0
  const allDone = closedDays >= target
  return (
    <div className={`s4-summary ${allDone ? 's4-summary--done' : ''}`}>
      <span className="s4-summary__label">
        {allDone ? `Закрыто дней ${target}/${target} ✓` : `Закрыто дней: ${closedDays} / ${target}`}
      </span>
      {!allDone && (
        <div className="s4-summary__bar">
          <div className="s4-summary__fill" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}

// ─── Главный компонент ───────────────────────────────────────────────────────

interface Props {
  blockId: number
}

export function Stage4Status({ blockId }: Props) {
  const [state, dispatch] = useReducer(reducer, { phase: 'idle' })

  useEffect(() => {
    dispatch({ type: 'FETCH' })
    let cancelled = false

    fetch(`/api/m/block-status/${blockId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData: getInitData() }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: BlockStatus & { ok: boolean }) => {
        if (cancelled) return
        if (data.ok) {
          dispatch({ type: 'OK', status: data })
        } else {
          dispatch({ type: 'FAIL' })
        }
      })
      .catch(() => {
        if (!cancelled) dispatch({ type: 'FAIL' })
      })

    return () => {
      cancelled = true
    }
  }, [blockId])

  if (state.phase !== 'done') return null

  const { status } = state

  return (
    <>
      {/* Сводка прогресса над карточками */}
      <SummaryBar closedDays={status.closedDays} target={status.target} />

      {/*
       * Бейджи статуса вставляются в DOM-карточки Stage4Nav (Server Component)
       * через insertAdjacentElement после монтирования.
       */}
      <Stage4StatusInserter status={status} />
    </>
  )
}

// ─── DOM-вставка бейджей в карточки Stage4Nav ────────────────────────────────

function upsertBadge(card: HTMLElement, el: HTMLElement) {
  const body = card.querySelector('.lesson-stage4-card__body')
  if (!body) return
  const old = body.querySelector('.s4-status-badge')
  if (old) old.remove()
  body.appendChild(el)
}

function makeBadge(classes: string, text: string): HTMLElement {
  const span = document.createElement('span')
  span.className = `s4-status-badge ${classes}`
  span.textContent = text
  return span
}

function Stage4StatusInserter({ status }: { status: BlockStatus }) {
  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('[data-s4-key]')
    cards.forEach((card) => {
      const key = card.getAttribute('data-s4-key')
      let el: HTMLElement | null = null

      switch (key) {
        case 'quiz':
          el = makeBadge(
            status.quiz ? 's4-status-badge--done' : '',
            status.quiz ? 'сдан' : 'не сдан',
          )
          break
        case 'trainer':
          // Дневной: «сегодня» отмечен?
          if (status.today.trainer) {
            el = makeBadge('s4-status-badge--done', 'сегодня ✓')
          }
          break
        case 'cross_photo':
          // Дневной: фото сегодня
          if (status.today.cross) {
            el = makeBadge('s4-status-badge--done', 'сегодня ✓')
          }
          break
        case 'prayer':
          // Дневной: молитва сегодня
          if (status.today.prayer) {
            el = makeBadge('s4-status-badge--done', 'сегодня ✓')
          }
          break
        case 'recitation':
          // «Пересказ блока» = аудио-пересказ → отметка по recitationAudio
          if (status.today.recitationAudio) {
            el = makeBadge('s4-status-badge--done', 'сегодня ✓')
          }
          break
        case 'locations':
          // «Местописания» = видеокружки → отметка по recitationVideo
          if (status.today.recitationVideo) {
            el = makeBadge('s4-status-badge--done', 'сегодня ✓')
          }
          break
        case 'emotions':
          // Опциональный пункт — нет в новой модели block-status
          break
      }

      if (el) upsertBadge(card, el)
    })

    return () => {
      cards.forEach((card) => {
        const body = card.querySelector('.lesson-stage4-card__body')
        if (body) {
          const old = body.querySelector('.s4-status-badge')
          if (old) old.remove()
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  return null
}
