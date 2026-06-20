'use client'

import { useState } from 'react'
import type { CuratorRow } from './types'

/**
 * Таблица кураторов с разворотом списка учеников.
 * Имена/города выводятся как React-текст (auto-escape, без innerHTML).
 */
export function CuratorsView({ curators }: { curators: CuratorRow[] }) {
  const [openId, setOpenId] = useState<string | null>(null)

  if (curators.length === 0) {
    return <div className="panel-empty">Кураторов пока нет</div>
  }

  return (
    <div className="panel-table-wrap">
      <table className="panel-table">
        <thead>
          <tr>
            <th>Куратор</th>
            <th>Город</th>
            <th>Ученики</th>
          </tr>
        </thead>
        <tbody>
          {curators.map((cu) => {
            const isOpen = openId === cu.id
            const hasStudents = cu.studentsCount > 0
            return (
              <CuratorRowGroup
                key={cu.id}
                curator={cu}
                isOpen={isOpen}
                hasStudents={hasStudents}
                onToggle={() => setOpenId(isOpen ? null : cu.id)}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function CuratorRowGroup({
  curator,
  isOpen,
  hasStudents,
  onToggle,
}: {
  curator: CuratorRow
  isOpen: boolean
  hasStudents: boolean
  onToggle: () => void
}) {
  const cityLabel = curator.city
    ? curator.country
      ? `${curator.city}, ${curator.country}`
      : curator.city
    : '—'

  return (
    <>
      <tr
        onClick={hasStudents ? onToggle : undefined}
        style={{ cursor: hasStudents ? 'pointer' : 'default' }}
      >
        <td>
          <div style={{ fontWeight: 600 }}>{curator.name ?? 'Без имени'}</div>
          {curator.nick ? <div className="panel-muted">{curator.nick}</div> : null}
        </td>
        <td>{cityLabel}</td>
        <td>
          <span
            className={
              hasStudents ? 'panel-badge panel-badge--acc' : 'panel-badge'
            }
          >
            {curator.studentsCount}
          </span>
          {hasStudents ? (
            <button
              type="button"
              className="panel-btn"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
              style={{ marginLeft: 10 }}
            >
              {isOpen ? 'Скрыть' : 'Показать'}
            </button>
          ) : null}
        </td>
      </tr>
      {isOpen && hasStudents ? (
        <tr>
          <td colSpan={3}>
            <div className="panel-section-title">Ученики ({curator.studentsCount})</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {curator.students.map((s) => (
                <li key={s.id} style={{ marginBottom: 4 }}>
                  {s.name ?? 'Без имени'}
                  {s.nick ? <span className="panel-muted"> {s.nick}</span> : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  )
}
