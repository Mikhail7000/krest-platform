'use client'

import { useState } from 'react'
import type { ProgressRow } from '@/app/api/panel/stats/stats-data'

/**
 * Столбчатый график распределения учеников по текущему блоку (1..10).
 * Клиентский — только ради hover-подсветки и подсказки. Использует готовые
 * классы panel-chart* из panel.css.
 */
export function ProgressChart({ data }: { data: ProgressRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.count))

  return (
    <div className="panel-chart">
      {data.map((d) => {
        const pct = Math.round((d.count / max) * 100)
        const active = hover === d.block
        return (
          <div
            key={d.block}
            className="panel-chart__col"
            onMouseEnter={() => setHover(d.block)}
            onMouseLeave={() => setHover((h) => (h === d.block ? null : h))}
            title={`Блок ${d.block}: ${d.count} ${plural(d.count)}`}
          >
            <span className="panel-chart__val">{d.count}</span>
            <div
              className="panel-chart__bar"
              style={{
                height: `${pct}%`,
                opacity: hover === null || active ? 1 : 0.55,
                transition: 'opacity 0.15s',
              }}
            />
            <span className="panel-chart__label">Б{d.block}</span>
          </div>
        )
      })}
    </div>
  )
}

function plural(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'ученик'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'ученика'
  return 'учеников'
}
