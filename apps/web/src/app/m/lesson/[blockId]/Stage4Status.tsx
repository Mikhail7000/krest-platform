'use client'

/**
 * Stage4Status — клиентский компонент трекинга практических пунктов блока.
 * Фетчит /api/m/block-status/[blockId] и рисует бейджи статуса рядом с
 * каждой карточкой Stage4Nav. Не трогает существующие бейджи обязательности.
 *
 * Бейдж статуса:
 *  - выполнено → зелёный "выполнено"
 *  - recurring → "N / 7" (серый пока не выполнено, зелёный когда N>=7)
 *  - не выполнено → ничего (карточка и так понятна)
 */

import { useEffect, useReducer } from 'react'

// ─── Типы ───────────────────────────────────────────────────────────────────

interface RecurringStatus {
  done: number
  target: number
}

interface BlockStatus {
  quiz: boolean
  locations: boolean
  recitation: boolean
  recitation_full: boolean
  cross_photo: RecurringStatus
  prayer: RecurringStatus
  friday: boolean
  emotions: boolean
  completed: number
  total: number
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

// ─── Мини-сводка ────────────────────────────────────────────────────────────

function SummaryBar({ completed, total }: { completed: number; total: number }) {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const allDone = completed >= total
  return (
    <div className={`s4-summary ${allDone ? 's4-summary--done' : ''}`}>
      <span className="s4-summary__label">
        {allDone ? 'Все задания выполнены' : `Выполнено ${completed} из ${total}`}
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
      <SummaryBar completed={status.completed} total={status.total} />

      {/*
       * Бейджи для каждой карточки выдаются через data-атрибут на карточке.
       * Поскольку Stage4Nav — Server Component и рендерит <a>-теги напрямую,
       * вставить бейджи внутрь него без гидрации нельзя.
       * Используем порталы через DOM после монтирования — они ищут
       * data-s4-key атрибуты на карточках и рендерят бейджи рядом.
       * Компонент ниже (Stage4StatusInserter) вставляет бейджи через insertAdjacentElement.
       */}

      <Stage4StatusInserter status={status} />
    </>
  )
}

// ─── Вставка бейджей в DOM-карточки Stage4Nav ────────────────────────────────
// Stage4Nav — Server Component, его дом-элементы доступны после гидрации.
// Находим <a data-s4-key="..."> и вставляем span с бейджем в .lesson-stage4-card__body.

function upsertBadge(card: HTMLElement, el: HTMLElement) {
  const body = card.querySelector('.lesson-stage4-card__body')
  if (!body) return
  // Удалить предыдущий статус-бейдж если есть
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
    // Карточки должны иметь data-s4-key="quiz|locations|recitation|cross_photo|prayer|friday|emotions"
    const cards = document.querySelectorAll<HTMLElement>('[data-s4-key]')
    cards.forEach((card) => {
      const key = card.getAttribute('data-s4-key')
      let el: HTMLElement | null = null

      switch (key) {
        case 'quiz':
          if (status.quiz) el = makeBadge('s4-status-badge--done', 'выполнено')
          break
        case 'locations':
          if (status.locations) el = makeBadge('s4-status-badge--done', 'выполнено')
          break
        case 'recitation':
          if (status.recitation_full) {
            el = makeBadge('s4-status-badge--done', 'выполнено')
          } else if (status.recitation) {
            el = makeBadge('s4-status-badge--partial', 'аудио сдано')
          }
          break
        case 'cross_photo': {
          const { done, target } = status.cross_photo
          const cls = done >= target ? 's4-status-badge--done' : 's4-status-badge--recurring'
          el = makeBadge(cls, `${done} / ${target}`)
          break
        }
        case 'prayer': {
          const { done, target } = status.prayer
          const cls = done >= target ? 's4-status-badge--done' : 's4-status-badge--recurring'
          el = makeBadge(cls, `${done} / ${target}`)
          break
        }
        case 'friday':
          if (status.friday) el = makeBadge('s4-status-badge--done', 'выполнено')
          break
        case 'emotions':
          if (status.emotions) el = makeBadge('s4-status-badge--done', 'отправлено')
          break
      }

      if (el) upsertBadge(card, el)
    })

    // Очищаем при размонтировании
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

  // Ничего не рендерим — только DOM-эффект
  return null
}

