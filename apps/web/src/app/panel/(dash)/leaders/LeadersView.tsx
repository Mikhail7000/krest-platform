'use client'

import { useState } from 'react'
import { StaffAddForm } from '../curators/StaffAddForm'
import { RoleModal } from '../curators/RoleModal'
import type { CuratorRow } from '../curators/types'
import type { LeaderRow } from './types'

/** LeaderRow → CuratorRow для переиспользования RoleModal (studentsCount=0: лидер
 *  не держит учеников напрямую, ложного предупреждения об отвязке быть не должно). */
function toCuratorRow(l: LeaderRow): CuratorRow {
  return {
    id: l.id,
    name: l.name,
    nick: l.nick,
    role: 'city_leader',
    isProtected: l.isProtected,
    city: l.city,
    cityId: l.cityId,
    country: l.country,
    studentsCount: 0,
    students: [],
  }
}

/**
 * Таблица лидеров городов: город, число кураторов (разворот), вход в их панель,
 * смена роли. Добавление нового лидера — через общий StaffAddForm (city_leader).
 */
export function LeadersView({
  leaders,
  cities,
  isSuperAdmin,
  canViewAs = false,
  isOwner = false,
}: {
  leaders: LeaderRow[]
  cities: { id: number; name: string }[]
  isSuperAdmin: boolean
  canViewAs?: boolean
  isOwner?: boolean
}) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [roleTarget, setRoleTarget] = useState<LeaderRow | null>(null)
  void isOwner // view-as для лидеров доступен любому реальному админу

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <StaffAddForm kind="city_leader" cities={cities} showCity cityRequired />
      </div>

      {leaders.length === 0 ? (
        <div className="panel-empty">Лидеров городов пока нет</div>
      ) : (
        <div className="panel-table-wrap">
          <table className="panel-table">
            <thead>
              <tr>
                <th>Лидер</th>
                <th>Город</th>
                <th>Кураторов</th>
                <th>Действия</th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((l) => (
                <LeaderRowGroup
                  key={l.id}
                  leader={l}
                  isOpen={openId === l.id}
                  canViewAs={canViewAs && !l.isProtected}
                  onToggle={() => setOpenId(openId === l.id ? null : l.id)}
                  onRole={() => setRoleTarget(l)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {roleTarget ? (
        <RoleModal
          curator={toCuratorRow(roleTarget)}
          isSuperAdmin={isSuperAdmin}
          cities={cities}
          onClose={() => setRoleTarget(null)}
        />
      ) : null}
    </>
  )
}

function LeaderRowGroup({
  leader,
  isOpen,
  canViewAs,
  onToggle,
  onRole,
}: {
  leader: LeaderRow
  isOpen: boolean
  canViewAs: boolean
  onToggle: () => void
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
