'use client'

import { useEffect, useMemo, useState } from 'react'
import type {
  ReassignCity,
  ReassignCurator,
} from '@/app/api/panel/curators/reassign/route'

const NO_CITY = '__none__'

/**
 * Доска перепривязки кураторов: колонки-города + «Без города».
 * Перенос — выпадашкой «Переместить» на карточке куратора (POST curator-city).
 * Без drag-and-drop (надёжно на мобильном). Имена — React-текст (auto-escape).
 */
export function ReassignBoard() {
  const [cities, setCities] = useState<ReassignCity[]>([])
  const [curators, setCurators] = useState<ReassignCurator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/curators/reassign')
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка загрузки')
      setCities(json.cities as ReassignCity[])
      setCurators(json.curators as ReassignCurator[])
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

  const move = async (cur: ReassignCurator, target: string) => {
    const cityId = target === NO_CITY ? null : Number(target)
    if (cityId === cur.cityId) return
    setBusyId(cur.id)
    try {
      const res = await fetch('/api/panel/actions/curator-city', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: cur.id, cityId }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Не удалось переместить')
      setCurators((list) => list.map((c) => (c.id === cur.id ? { ...c, cityId } : c)))
      flash('ok', `${cur.name ?? 'Куратор'} перемещён`)
    } catch (e) {
      flash('err', e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusyId(null)
    }
  }

  // Группировка кураторов по городу (+ корзина «Без города»).
  const columns = useMemo(() => {
    const byCity = new Map<number | null, ReassignCurator[]>()
    for (const c of curators) {
      const arr = byCity.get(c.cityId) ?? []
      arr.push(c)
      byCity.set(c.cityId, arr)
    }
    const cols = cities.map((city) => ({ city, items: byCity.get(city.id) ?? [] }))
    cols.push({
      city: { id: -1, name: 'Без города', country: null, leaderName: null },
      items: byCity.get(null) ?? [],
    })
    return cols
  }, [cities, curators])

  if (loading) return <div className="panel-empty">Загрузка…</div>
  if (error) return <div className="panel-empty">{error}</div>

  return (
    <>
      {notice ? (
        <div
          className="panel-card"
          style={{ marginBottom: 14, borderLeft: `3px solid ${notice.kind === 'ok' ? '#16a34a' : '#dc2626'}` }}
        >
          <span className={notice.kind === 'ok' ? 'panel-badge panel-badge--ok' : 'panel-badge panel-badge--err'}>
            {notice.kind === 'ok' ? 'Готово' : 'Ошибка'}
          </span>{' '}
          {notice.text}
        </div>
      ) : null}

      <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', minWidth: 'min-content' }}>
          {columns.map(({ city, items }) => {
            const isNone = city.id === -1
            return (
              <div
                key={city.id}
                className="panel-card"
                style={{ width: 240, flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: 10 }}
              >
                <div>
                  <div className="panel-section-title" style={{ marginBottom: 2 }}>
                    {city.name}
                  </div>
                  <div className="panel-muted" style={{ fontSize: '0.8rem' }}>
                    {isNone
                      ? 'кураторы без привязки'
                      : city.leaderName
                        ? `лидер: ${city.leaderName}`
                        : 'лидер не назначен'}
                    {' · '}
                    {items.length} кур.
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="panel-muted" style={{ fontSize: '0.82rem', padding: '6px 0' }}>
                    Пусто
                  </div>
                ) : (
                  items.map((cur) => (
                    <div
                      key={cur.id}
                      style={{
                        border: '1px solid var(--pl-border, #e5e7eb)',
                        borderRadius: 10,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                        opacity: busyId === cur.id ? 0.5 : 1,
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cur.name ?? 'Без имени'}</div>
                      {cur.nick ? (
                        <div className="panel-muted" style={{ fontSize: '0.78rem' }}>
                          {cur.nick}
                        </div>
                      ) : null}
                      <div className="panel-muted" style={{ fontSize: '0.78rem' }}>
                        учеников: {cur.studentsCount}
                      </div>
                      <select
                        className="panel-select"
                        value={cur.cityId == null ? NO_CITY : String(cur.cityId)}
                        disabled={busyId === cur.id}
                        onChange={(e) => move(cur, e.target.value)}
                        style={{ fontSize: '0.82rem' }}
                      >
                        {cities.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {c.name}
                          </option>
                        ))}
                        <option value={NO_CITY}>— Без города —</option>
                      </select>
                    </div>
                  ))
                )}
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
