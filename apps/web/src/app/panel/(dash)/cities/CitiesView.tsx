'use client'

import { useMemo, useState } from 'react'

type CityStatus = 'active' | 'coming_soon' | 'inactive'

interface City {
  id: number
  name: string
  country: string
  status: CityStatus
  students: number
  curators: number
}

interface Country {
  id: number
  name: string
  cities: number
  activeCities: number
  students: number
  curators: number
}

const STATUS_LABEL: Record<CityStatus, string> = {
  active: 'Активен',
  coming_soon: 'Скоро',
  inactive: 'Неактивен',
}

const STATUS_BADGE: Record<CityStatus, string> = {
  active: 'panel-badge panel-badge--ok',
  coming_soon: 'panel-badge panel-badge--warn',
  inactive: 'panel-badge',
}

export function CitiesView({ cities, countries }: { cities: City[]; countries: Country[] }) {
  const [hideEmpty, setHideEmpty] = useState(false)

  const visibleCities = useMemo(
    () => (hideEmpty ? cities.filter((c) => c.students > 0) : cities),
    [cities, hideEmpty],
  )

  const maxStudents = useMemo(
    () => Math.max(1, ...countries.map((c) => c.students)),
    [countries],
  )

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          marginBottom: 14,
        }}
      >
        <h2 className="panel-section-title" style={{ margin: 0 }}>
          Города
        </h2>
        <button
          type="button"
          className={`panel-btn${hideEmpty ? ' panel-btn--primary' : ''}`}
          onClick={() => setHideEmpty((v) => !v)}
        >
          {hideEmpty ? 'Показать все' : 'Скрыть без учеников'}
        </button>
      </div>

      {visibleCities.length === 0 ? (
        <div className="panel-empty">Городов с учениками пока нет.</div>
      ) : (
        <div className="panel-table-wrap" style={{ marginBottom: 24 }}>
          <table className="panel-table">
            <thead>
              <tr>
                <th>Город</th>
                <th>Страна</th>
                <th>Статус</th>
                <th>Учеников</th>
                <th>Кураторов</th>
              </tr>
            </thead>
            <tbody>
              {visibleCities.map((c) => {
                const dimmed = c.students === 0
                return (
                  <tr key={c.id} style={dimmed ? { color: 'var(--pl-mut)' } : undefined}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td>{c.country}</td>
                    <td>
                      <span className={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</span>
                    </td>
                    <td>{c.students}</td>
                    <td>{c.curators}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="panel-section-title">По странам</h2>
      {countries.length === 0 ? (
        <div className="panel-empty">Нет данных по странам.</div>
      ) : (
        <div className="panel-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {countries.map((c) => (
            <div key={c.id} className="panel-card">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <span style={{ fontWeight: 700 }}>{c.name}</span>
                <span style={{ fontWeight: 800 }}>{c.students}</span>
              </div>
              <div className="panel-bar" style={{ marginBottom: 10 }}>
                <div
                  className="panel-bar__fill"
                  style={{ width: `${Math.round((c.students / maxStudents) * 100)}%` }}
                />
              </div>
              <div className="panel-muted" style={{ fontSize: '0.82rem' }}>
                {c.activeCities} активн. из {c.cities} городов · {c.curators} кураторов
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
