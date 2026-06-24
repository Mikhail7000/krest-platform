'use client'

/**
 * Stage4Status — клиентский компонент трекинга практики блока (дневная модель).
 * Фетчит /api/m/block-status/[blockId] и отображает:
 * - Сводку «Закрыто дней N/7»
 * - Бейджи статуса «сегодня» на дневных карточках (cross_photo, prayer, trainer)
 * - Бейджи разовых пунктов (quiz, friday) — всегда
 * - Местописания (recitationAudio, recitationVideo) — дневные
 */

import { useEffect } from 'react'
import { useBlockStatus, type BlockStatusData } from '@/lib/m/block-status-cache'

// ─── Типы ───────────────────────────────────────────────────────────────────

type BlockStatus = BlockStatusData

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
  const status = useBlockStatus(blockId)

  if (!status) return null

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
    // Какие дневные карточки закрыты сегодня → вся карточка подсвечивается зелёным.
    const doneMap: Record<string, boolean> = {
      cross_photo: status.today.cross,
      prayer: status.today.prayer,
      recitation: status.today.pereskaz,
      locations: status.today.mestopisaniya,
    }

    const cards = document.querySelectorAll<HTMLElement>('[data-s4-key]')
    cards.forEach((card) => {
      const key = card.getAttribute('data-s4-key')
      let el: HTMLElement | null = null

      // Подсветка всей карточки, если задача сегодня выполнена
      card.classList.toggle('lesson-stage4-card--done', key ? doneMap[key] === true : false)

      switch (key) {
        case 'quiz':
          el = makeBadge(
            status.quiz ? 's4-status-badge--done' : '',
            status.quiz ? 'сдан' : 'не сдан',
          )
          break
        case 'trainer':
          // Тренажёр — учебный режим, НЕ обязателен для сдачи блока
          el = makeBadge('', 'по желанию')
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
          // «Пересказ блока» = аудио-пересказ (ежедневно)
          if (status.today.pereskaz) {
            el = makeBadge('s4-status-badge--done', 'сегодня ✓')
          }
          break
        case 'locations':
          // «Местописания» = ежедневно (все стихи закрыты видеокружком сегодня)
          if (status.today.mestopisaniya) {
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
        card.classList.remove('lesson-stage4-card--done')
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
