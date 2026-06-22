'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'

interface DayActivity {
  date: string
  opened: boolean
  cross: boolean
  prayer: boolean
  recit: boolean
  loc: boolean
  quiz: boolean
  closed: boolean
}
interface StudentDays {
  id: string
  name: string | null
  days: DayActivity[]
}

const PRACTICES: { key: keyof DayActivity; label: string }[] = [
  { key: 'opened', label: 'Заход' },
  { key: 'cross', label: 'Крест' },
  { key: 'prayer', label: 'Молитва' },
  { key: 'recit', label: 'Пересказ' },
  { key: 'loc', label: 'Местописания' },
  { key: 'quiz', label: 'Квиз' },
]

function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })
}

export function ActivityClient() {
  const [students, setStudents] = useState<PanelStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<StudentDays[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetch('/api/panel/students', { method: 'POST', body: '{}' })
      .then((r) => r.json())
      .then((j) => (j.ok ? setStudents(j.students) : setError(j.error || 'Ошибка')))
      .catch(() => setError('Ошибка загрузки'))
      .finally(() => setLoading(false))
  }, [])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return students
    return students.filter(
      (s) =>
        (s.fullName ?? '').toLowerCase().includes(q) ||
        (s.contact ?? '').toLowerCase().includes(q),
    )
  }, [students, query])

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const toggleAll = () =>
    setSelected((prev) => (prev.size === visible.length ? new Set() : new Set(visible.map((s) => s.id))))

  const showActivity = async () => {
    if (selected.size === 0) return
    setLoadingDetail(true)
    try {
      const res = await fetch('/api/panel/activity/days', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userIds: [...selected] }),
      })
      const j = await res.json()
      if (j.ok) setDetail(j.students as StudentDays[])
    } finally {
      setLoadingDetail(false)
    }
  }

  if (loading) return <div className="panel-empty">Загрузка…</div>
  if (error) return <div className="panel-empty">{error}</div>

  return (
    <>
      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          className="panel-input"
          placeholder="Поиск по имени или нику…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <button
          type="button"
          className="panel-btn panel-btn--primary"
          disabled={selected.size === 0 || loadingDetail}
          onClick={showActivity}
        >
          {loadingDetail ? 'Загрузка…' : `Показать активность (${selected.size})`}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="panel-empty">{query ? 'Никто не найден' : 'Учеников пока нет'}</div>
      ) : (
        <div className="panel-table-wrap" style={{ marginBottom: 24 }}>
          <table className="panel-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input
                    type="checkbox"
                    checked={visible.length > 0 && selected.size === visible.length}
                    onChange={toggleAll}
                    aria-label="Выбрать всех"
                  />
                </th>
                <th>Ученик</th>
                <th>Город</th>
                <th>Куратор</th>
                <th>Сдано</th>
                <th>Дней закрыто</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => toggle(s.id)}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id)}
                      onChange={() => toggle(s.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.fullName || 'Без имени'}</div>
                    {s.contact ? (
                      <div className="panel-muted" style={{ fontSize: '0.8rem' }}>{s.contact}</div>
                    ) : null}
                  </td>
                  <td>{s.cityName || <span className="panel-muted">—</span>}</td>
                  <td>{s.curatorName || <span className="panel-muted">нет</span>}</td>
                  <td><span className="panel-badge panel-badge--acc">{s.passedBlocks}/10</span></td>
                  <td>{s.closedDays}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail?.map((st) => <DayGrid key={st.id} student={st} />)}
    </>
  )
}

function DayGrid({ student }: { student: StudentDays }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="panel-section-title">{student.name || 'Без имени'}</div>
      {student.days.length === 0 ? (
        <div className="panel-card"><div className="panel-empty">Активности нет</div></div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>День</th>
                {PRACTICES.map((p) => (
                  <th key={p.key} style={{ textAlign: 'center' }}>{p.label}</th>
                ))}
                <th style={{ textAlign: 'center' }}>День закрыт</th>
              </tr>
            </thead>
            <tbody>
              {student.days.map((d) => (
                <tr key={d.date}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(d.date)}</td>
                  {PRACTICES.map((p) => (
                    <td
                      key={p.key}
                      style={{ textAlign: 'center', color: d[p.key] ? '#16a34a' : '#cbd0d8', fontWeight: 700 }}
                    >
                      {d[p.key] ? '✓' : '·'}
                    </td>
                  ))}
                  <td style={{ textAlign: 'center' }}>
                    {d.closed ? (
                      <span className="panel-badge panel-badge--ok">закрыт</span>
                    ) : (
                      <span className="panel-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
