'use client'

import Link from 'next/link'
import type { ComponentType, SVGProps } from 'react'
import { useBlockStatus, type BlockStatusData } from '@/lib/m/block-status-cache'
import { IconBook, IconCamera, IconCheck, IconCross, IconMic } from '@/app/m/_components/icons'

type TodayKey = keyof BlockStatusData['today']

/** 4 практики дня в каноническом порядке; иконки — те же, что в уроке (Stage4Nav). */
const TASKS: {
  key: TodayKey
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  path: string
}[] = [
  { key: 'cross', label: 'Фото Креста', Icon: IconCamera, path: 'cross-photo' },
  { key: 'prayer', label: 'Молитва', Icon: IconCross, path: 'prayer' },
  { key: 'mestopisaniya', label: 'Местописания', Icon: IconBook, path: 'locations' },
  { key: 'pereskaz', label: 'Пересказ', Icon: IconMic, path: 'recitation' },
]

/**
 * Карточка «Закрой день» на дашборде: 4 практики с галочками и переходом
 * сразу на нужный экран (раньше до каждой было 2-3 перехода через урок).
 * Данные — из того же SWR-кэша, что и HeaderProgress (запрос общий).
 */
export function TodayCard({ blockId }: { blockId: number | null }) {
  const status = useBlockStatus(blockId)
  if (blockId == null || !status) return null

  const done = TASKS.filter((t) => status.today[t.key]).length
  const dayClosed = done === TASKS.length || !status.canActToday

  if (dayClosed) {
    return (
      <div className="miniapp-container tc-wrap">
        <div className="tc-card tc-card--done">
          <span className="tc-done-icon">
            <IconCheck className="tc-done-icon__svg" />
          </span>
          <div>
            <div className="tc-title">День закрыт</div>
            <div className="tc-subtitle">
              {status.nextDayLocked
                ? 'Новый день откроется в полночь. Отдыхай!'
                : 'Все практики на сегодня сданы.'}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="miniapp-container tc-wrap">
      <div className="tc-card">
        <div className="tc-head">
          <span className="tc-title">Закрой день</span>
          <span className="tc-count">{done} из {TASKS.length}</span>
        </div>
        <div className="tc-rows">
          {TASKS.map((t) => {
            const isDone = status.today[t.key]
            return (
              <Link
                key={t.key}
                href={`/m/${t.path}/${blockId}`}
                className={`tc-row${isDone ? ' tc-row--done' : ''}`}
              >
                <span className="tc-row__icon">
                  <t.Icon className="tc-row__icon-svg" />
                </span>
                <span className="tc-row__label">{t.label}</span>
                <span className={`tc-row__mark${isDone ? ' tc-row__mark--done' : ''}`}>
                  {isDone ? <IconCheck className="tc-row__mark-svg" /> : '›'}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
