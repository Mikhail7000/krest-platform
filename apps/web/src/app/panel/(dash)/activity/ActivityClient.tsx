'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'
import { buildReport, DayGrid, type StudentDays } from './activityBits'

export function ActivityClient() {
  const [students, setStudents] = useState<PanelStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [detail, setDetail] = useState<StudentDays[] | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [report, setReport] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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

  const generate = async () => {
    if (selected.size === 0) return
    setLoadingDetail(true)
    setCopied(false)
    try {
      const res = await fetch('/api/panel/activity/days', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userIds: [...selected] }),
      })
      const j = await res.json()
      if (j.ok) {
        const days = j.students as StudentDays[]
        setDetail(days)
        setReport(buildReport(students, days))
      }
    } finally {
      setLoadingDetail(false)
    }
  }

  const copyReport = async () => {
    if (!report) return
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
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
          onClick={generate}
        >
          {loadingDetail ? 'Формирую…' : `Сформировать отчёт (${selected.size})`}
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

      {report ? (
        <div className="panel-card" style={{ marginBottom: 22 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap',
              marginBottom: 10,
            }}
          >
            <div className="panel-section-title" style={{ margin: 0 }}>Отчёт (текст)</div>
            <button type="button" className="panel-btn panel-btn--primary" onClick={copyReport}>
              {copied ? '✓ Скопировано' : 'Копировать'}
            </button>
          </div>
          <textarea
            readOnly
            value={report}
            onFocus={(e) => e.currentTarget.select()}
            className="panel-input"
            style={{
              width: '100%',
              minHeight: 220,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.8rem',
              whiteSpace: 'pre',
              resize: 'vertical',
            }}
          />
        </div>
      ) : null}

      {detail?.map((st) => <DayGrid key={st.id} student={st} />)}
    </>
  )
}
