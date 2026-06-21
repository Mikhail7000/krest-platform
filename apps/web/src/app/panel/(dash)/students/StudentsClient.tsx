'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'
import type { Curator } from './StudentRowActions'
import { StudentRow } from './studentBits'
import { COLUMNS, compareStudents, defaultDir, type SortDir, type SortKey } from './studentsSort'

export function StudentsClient() {
  const [students, setStudents] = useState<PanelStudentRow[]>([])
  const [curators, setCurators] = useState<Curator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [adding, setAdding] = useState(false)
  const [newNick, setNewNick] = useState('')
  const [addBusy, setAddBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/students', { method: 'POST', body: '{}' })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка загрузки')
      setStudents(json.students as PanelStudentRow[])
      setCurators(json.curators as Curator[])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text })
    setTimeout(() => setNotice(null), 3500)
  }

  const submitAdd = async () => {
    if (!newNick.trim() || addBusy) return
    setAddBusy(true)
    try {
      const res = await fetch('/api/panel/actions/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: newNick }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Не удалось добавить')
      flash('ok', json.already ? `${json.handle} обновлён — слот свободен` : `${json.handle} добавлен`)
      setNewNick('')
      setAdding(false)
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setAddBusy(false)
    }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const arr = students.filter((s) => {
      if (!q) return true
      return (
        (s.fullName ?? '').toLowerCase().includes(q) ||
        (s.contact ?? '').toLowerCase().includes(q)
      )
    })
    const mul = sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => compareStudents(a, b, sortKey) * mul)
    return arr
  }, [students, query, sortKey, sortDir])

  const onSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(defaultDir(key))
    }
  }

  return (
    <>
      {notice && (
        <div className={`panel-card`} style={{ marginBottom: 16, borderLeft: `3px solid ${notice.kind === 'ok' ? '#16a34a' : '#dc2626'}` }}>
          <span className={notice.kind === 'ok' ? 'panel-badge panel-badge--ok' : 'panel-badge panel-badge--err'}>
            {notice.kind === 'ok' ? 'Готово' : 'Ошибка'}
          </span>{' '}
          {notice.text}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 18, alignItems: 'center' }}>
        <input
          className="panel-input"
          placeholder="Поиск по имени или @нику…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <span className="panel-muted" style={{ fontSize: '0.82rem' }}>
          Сортировка — клик по заголовку столбца
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <button type="button" className="panel-btn panel-btn--primary" onClick={() => setAdding((v) => !v)}>
            + Добавить
          </button>
        </div>
      </div>

      {adding && (
        <div className="panel-card" style={{ marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <input
            className="panel-input"
            placeholder="@ник в Telegram"
            value={newNick}
            onChange={(e) => setNewNick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            style={{ maxWidth: 240 }}
            autoFocus
          />
          <button type="button" className="panel-btn panel-btn--primary" onClick={submitAdd} disabled={addBusy}>
            {addBusy ? 'Добавляю…' : 'В список'}
          </button>
          <button type="button" className="panel-btn" onClick={() => { setAdding(false); setNewNick('') }}>
            Отмена
          </button>
          <span className="panel-muted" style={{ fontSize: '0.82rem' }}>
            Ник заносится в whitelist как ученик. После /start в боте войдёт в приложение.
          </span>
        </div>
      )}

      {loading ? (
        <div className="panel-empty">Загрузка…</div>
      ) : error ? (
        <div className="panel-empty">{error}</div>
      ) : visible.length === 0 ? (
        <div className="panel-empty">{query ? 'Никто не найден' : 'Учеников пока нет'}</div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                {COLUMNS.map((c) =>
                  c.key ? (
                    <th
                      key={c.label}
                      onClick={() => onSort(c.key!)}
                      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                      title="Сортировать"
                    >
                      {c.label}{' '}
                      <span style={{ opacity: sortKey === c.key ? 1 : 0.3, fontSize: '0.78em' }}>
                        {sortKey === c.key ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    </th>
                  ) : (
                    <th key={c.label} style={{ textAlign: c.align }}>
                      {c.label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <StudentRow
                  key={s.id}
                  s={s}
                  curators={curators}
                  onDone={(msg) => { flash('ok', msg); void load() }}
                  onError={(msg) => flash('err', msg)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
