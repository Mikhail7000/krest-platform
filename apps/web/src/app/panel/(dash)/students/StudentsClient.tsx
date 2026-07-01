'use client'

import { useEffect, useMemo, useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'
import type { Curator } from './StudentRowActions'
import { StudentRow } from './studentBits'
import { COLUMNS, compareStudents, defaultDir, type SortDir, type SortKey } from './studentsSort'

type AddRole = 'student' | 'curator' | 'city_leader'

export function StudentsClient({
  role,
  cities = [],
}: {
  role: string
  cities?: { id: number; name: string }[]
}) {
  // admin/super_admin управляют строками (роль/куратор/удаление); куратор и лидер города — нет.
  const isAdminLevel = role === 'admin' || role === 'super_admin'
  const readOnlyRows = !isAdminLevel

  // Какие роли можно добавлять (зависит от роли добавляющего).
  const roleOptions: { v: AddRole; l: string }[] =
    role === 'curator'
      ? [{ v: 'student', l: 'Ученик' }]
      : role === 'city_leader'
        ? [
            { v: 'student', l: 'Ученик' },
            { v: 'curator', l: 'Куратор' },
          ]
        : [
            { v: 'student', l: 'Ученик' },
            { v: 'curator', l: 'Куратор' },
            { v: 'city_leader', l: 'Лидер города' },
          ]

  const [students, setStudents] = useState<PanelStudentRow[]>([])
  const [curators, setCurators] = useState<Curator[]>([])
  // Владелец платформы (is_protected) — только он правит замкнутые (locked) профили.
  const [isOwner, setIsOwner] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('created')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [adding, setAdding] = useState(false)
  const [newNick, setNewNick] = useState('')
  const [addRole, setAddRole] = useState<AddRole>('student')
  const [addCity, setAddCity] = useState('')
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
      setIsOwner(!!json.isOwner)
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

  // Город нужен админу при добавлении куратора/лидера (для лидера — обязателен).
  const needCity = isAdminLevel && (addRole === 'curator' || addRole === 'city_leader')

  const submitAdd = async () => {
    if (!newNick.trim() || addBusy) return
    if (addRole === 'city_leader' && isAdminLevel && !addCity) {
      flash('err', 'Для лидера города выбери город')
      return
    }
    setAddBusy(true)
    try {
      const res = await fetch('/api/panel/actions/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          username: newNick,
          role: addRole,
          cityId: needCity && addCity ? Number(addCity) : undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Не удалось добавить')
      flash('ok', json.already ? `${json.handle} обновлён` : `${json.handle} добавлен`)
      setNewNick('')
      setAdding(false)
      void load()
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
        (s.fullName ?? '').toLowerCase().includes(q) || (s.contact ?? '').toLowerCase().includes(q)
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

  const roleWord =
    addRole === 'city_leader' ? 'лидера города' : addRole === 'curator' ? 'куратора' : 'ученика'

  return (
    <>
      {notice && (
        <div
          className={`panel-card`}
          style={{ marginBottom: 16, borderLeft: `3px solid ${notice.kind === 'ok' ? '#16a34a' : '#dc2626'}` }}
        >
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
        <div
          className="panel-card"
          style={{ marginBottom: 18, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}
        >
          {roleOptions.length > 1 && (
            <select
              className="panel-input"
              value={addRole}
              onChange={(e) => setAddRole(e.target.value as AddRole)}
              style={{ maxWidth: 170 }}
            >
              {roleOptions.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.l}
                </option>
              ))}
            </select>
          )}
          <input
            className="panel-input"
            placeholder="@ник в Telegram"
            value={newNick}
            onChange={(e) => setNewNick(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitAdd()}
            style={{ maxWidth: 220 }}
            autoFocus
          />
          {needCity && (
            <select
              className="panel-input"
              value={addCity}
              onChange={(e) => setAddCity(e.target.value)}
              style={{ maxWidth: 180 }}
            >
              <option value="">
                {addRole === 'city_leader' ? 'Город (обязательно)' : 'Город (необязательно)'}
              </option>
              {cities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
          <button type="button" className="panel-btn panel-btn--primary" onClick={submitAdd} disabled={addBusy}>
            {addBusy ? 'Добавляю…' : 'В список'}
          </button>
          <button
            type="button"
            className="panel-btn"
            onClick={() => {
              setAdding(false)
              setNewNick('')
            }}
          >
            Отмена
          </button>
          <span className="panel-muted" style={{ fontSize: '0.82rem' }}>
            {roleWord} заносится в whitelist. После /start в боте войдёт в приложение.
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
                {COLUMNS.filter((c) => !readOnlyRows || c.label !== 'Действия').map((c) =>
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
                  isCurator={readOnlyRows}
                  viewerIsOwner={isOwner}
                  onDone={(msg) => {
                    flash('ok', msg)
                    void load()
                  }}
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
