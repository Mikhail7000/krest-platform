'use client'

import { useState } from 'react'
import type { LeaderRow as LeaderRowType } from './types'

/**
 * Строка лидера города в таблице: имя/ник, город, число кураторов (разворот),
 * действия — вход в их панель, смена города, смена роли.
 */
export function LeaderRow({
  leader,
  isOpen,
  canViewAs,
  onToggle,
  onAttach,
  onCity,
  onRole,
}: {
  leader: LeaderRowType
  isOpen: boolean
  canViewAs: boolean
  onToggle: () => void
  onAttach: () => void
  onCity: () => void
  onRole: () => void
}) {
  const [viewBusy, setViewBusy] = useState(false)
  const hasCurators = leader.curatorsCount > 0

  const enterViewAs = async () => {
    setViewBusy(true)
    try {
      const res = await fetch('/api/panel/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: leader.id }),
      })
      if (res.ok) {
        window.location.href = '/panel'
      } else {
        setViewBusy(false)
      }
    } catch {
      setViewBusy(false)
    }
  }

  const cityLabel = leader.city
    ? leader.country
      ? `${leader.city}, ${leader.country}`
      : leader.city
    : '—'

  return (
    <>
      <tr
        onClick={hasCurators ? onToggle : undefined}
        style={{ cursor: hasCurators ? 'pointer' : 'default' }}
      >
        <td>
          <div style={{ fontWeight: 600 }}>{leader.name ?? 'Без имени'}</div>
          {leader.nick ? <div className="panel-muted">{leader.nick}</div> : null}
          <span className="panel-badge panel-badge--acc" style={{ marginTop: 4, display: 'inline-block' }}>
            Лидер города
          </span>
        </td>
        <td>{cityLabel}</td>
        <td>
          <span className={hasCurators ? 'panel-badge panel-badge--acc' : 'panel-badge'}>
            {leader.curatorsCount}
          </span>
          {hasCurators ? (
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
        <td>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {canViewAs ? (
              <button
                type="button"
                className="panel-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  enterViewAs()
                }}
                disabled={viewBusy}
                title="Открыть панель этого лидера в режиме просмотра"
              >
                {viewBusy ? '…' : '👁 Войти как'}
              </button>
            ) : null}
            {leader.isProtected ? (
              <span className="panel-badge" style={{ alignSelf: 'center' }}>🔒 Защищён</span>
            ) : (
              <>
                <button
                  type="button"
                  className="panel-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onAttach()
                  }}
                >
                  🔗 Привязать кураторов
                </button>
                <button
                  type="button"
                  className="panel-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onCity()
                  }}
                >
                  🌍 Сменить город
                </button>
                <button
                  type="button"
                  className="panel-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onRole()
                  }}
                >
                  Сменить роль
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {isOpen && hasCurators ? (
        <tr>
          <td colSpan={4}>
            <div className="panel-section-title">Кураторы города ({leader.curatorsCount})</div>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {leader.curators.map((c) => (
                <li key={c.id} style={{ marginBottom: 4 }}>
                  {c.name ?? 'Без имени'}
                  {c.nick ? <span className="panel-muted"> {c.nick}</span> : null}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  )
}
