'use client'

import { useBlockStatus, type BlockStatusData } from '@/lib/m/block-status-cache'

type TodayStatus = BlockStatusData['today']

interface DayTask {
  key: keyof TodayStatus
  label: string
}

const DAY_TASKS: DayTask[] = [
  { key: 'cross', label: 'Фото Креста' },
  { key: 'prayer', label: 'Молитва' },
  { key: 'mestopisaniya', label: 'Местописания' },
  { key: 'pereskaz', label: 'Пересказ' },
]

/**
 * Баннер прогресса урока — дневная модель.
 * Показывает: N/7 закрытых дней + чеклист «сегодня» (5 задач) + квиз + пятница.
 */
export function BlockProgress({ blockId }: { blockId: number }) {
  const data = useBlockStatus(blockId)

  if (!data) return null

  const { closedDays, target, today } = data
  const pct = Math.round((Math.min(closedDays, target) / target) * 100)

  const todayAllDone = DAY_TASKS.every((t) => today[t.key])
  const pendingTasks = DAY_TASKS.filter((t) => !today[t.key])
  const blockComplete = closedDays >= target

  if (blockComplete) {
    return (
      <div className="lesson-progress-banner lesson-progress-banner--done">
        Блок выполнен — все условия соблюдены ✓
      </div>
    )
  }

  return (
    <div className="lesson-progress-banner">
      {/* Прогресс-бар «Закрыто дней» */}
      <div className="lesson-progress-banner__label">
        <span>Закрыто дней: {closedDays} / {target}</span>
        <span>{closedDays >= target ? '✓' : `${pct}%`}</span>
      </div>
      <div className="lesson-progress-bar">
        <div className="lesson-progress-bar__fill" style={{ width: `${pct}%` }} />
      </div>

      {/* «Сегодня» — блок */}
      {closedDays < target && (
        <div className="lesson-progress-today">
          {todayAllDone ? (
            <div className="lesson-progress-today__done">
              <span className="lesson-progress-today__done-title">✓ День закрыт!</span>
              <span className="lesson-progress-today__done-hint">
                Следующий день откроется в 00:00 по твоему времени. Тогда снова можно
                отметить местописания и пересказ — за новый день.
              </span>
            </div>
          ) : (
            <>
              <span className="lesson-progress-today__hint">
                Сегодня закрой день — осталось:
              </span>
              <ul className="lesson-progress-checklist">
                {DAY_TASKS.map((t) => (
                  <li
                    key={t.key}
                    className={`lesson-progress-check${today[t.key] ? ' lesson-progress-check--done' : ''}`}
                  >
                    <span className="lesson-progress-check__marker">
                      {today[t.key] ? '✓' : '○'}
                    </span>
                    <span className="lesson-progress-check__label">{t.label}</span>
                  </li>
                ))}
              </ul>
              <span className="lesson-progress-today__count">
                Осталось: {pendingTasks.length} из {DAY_TASKS.length}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  )
}
