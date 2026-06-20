'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'
import type { Curator } from './StudentRowActions'
import { StudentRow } from './studentBits'

type SortKey = 'name' | 'blocks' | 'days' | 'created'

export function StudentsClient() {
  const [students, setStudents] = useState<PanelStudentRow[]>([])
  const [curators, setCurators] = useState<Curator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortKey>('created')
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
    arr.sort((a, b) => {
      switch (sort) {
        case 'name':
          return (a.fullName ?? '').localeCompare(b.fullName ?? '', 'ru')
        case 'blocks':
          return b.passedBlocks - a.passedBlocks
        case 'days':
          return b.closedDays - a.closedDays
        case 'created':
        default:
          return (b.createdAt ?? '').localeCompare(a.createdAt ?? '')
      }
    })
    return arr
  }, [students, query, sort])

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
        <select className="panel-select" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} style={{ maxWidth: 200 }}>
          <option value="created">Сначала новые</option>
          <option value="name">По имени</option>
          <option value="blocks">По сданным блокам</option>
          <option value="days">По закрытым дням</option>
        </select>
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
                <th>Ученик</th>
                <th>Город</th>
                <th>Куратор</th>
                <th>Сдано</th>
                <th>Текущий блок</th>
                <th>Дней закрыто</th>
                <th>Создан</th>
                <th style={{ textAlign: 'right' }}>Действия</th>
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
