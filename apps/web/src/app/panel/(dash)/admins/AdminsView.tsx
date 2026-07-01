'use client'

import { useState } from 'react'
import { TgLink } from '../TgLink'
import { RoleModal } from '../curators/RoleModal'
import type { CuratorRow } from '../curators/types'

export interface AdminRowItem {
  id: string
  name: string | null
  nick: string | null
  role: string
  cityId: number | null
  cityName: string | null
  isProtected: boolean
  hasTelegram: boolean
  isSelf: boolean
}

/** AdminRowItem → CuratorRow для переиспользования RoleModal (метрики не нужны). */
function toCuratorRow(a: AdminRowItem): CuratorRow {
  return {
    id: a.id,
    name: a.name,
    nick: a.nick,
    role: a.role,
    isProtected: a.isProtected,
    city: a.cityName,
    cityId: a.cityId,
    country: null,
    leaderName: null,
    studentsCount: 0,
    students: [],
    activeToday: 0,
    closed7: 0,
    stuck: 0,
  }
}

export function AdminsView({
  admins,
  cities,
  canViewAs,
}: {
  admins: AdminRowItem[]
  cities: { id: number; name: string }[]
  canViewAs: boolean
}) {
  const [roleFor, setRoleFor] = useState<AdminRowItem | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const enterViewAs = async (id: string) => {
    setBusyId(id)
    setError(null)
    try {
      const res = await fetch('/api/panel/view-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: id }),
      })
      if (res.ok) {
        window.location.href = '/panel' // полная перезагрузка под view-as сессией
        return
      }
      const b = (await res.json().catch(() => ({}))) as { error?: string }
      setError(b.error ?? `Ошибка ${res.status}`)
    } catch {
      setError('Сетевая ошибка')
    }
    setBusyId(null)
  }

  return (
    <>
      {error && (
        <div className="panel-card" style={{ marginBottom: 14, borderLeft: '3px solid var(--pl-err, #ef4444)' }}>
          {error}
        </div>
      )}
      <div className="panel-table-wrap">
        <table className="panel-table">
          <thead>
            <tr>
              <th>Администратор</th>
              <th>Город</th>
              <th>Роль</th>
              <th style={{ textAlign: 'right' }}>Действия</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {a.name ?? 'Без имени'}
                    {a.isSelf ? <span className="panel-muted"> (вы)</span> : null}
                  </div>
                  <TgLink nick={a.nick} />
                </td>
                <td>{a.cityName ?? <span className="panel-muted">—</span>}</td>
                <td>
                  {a.role === 'super_admin' ? (
                    <span className="panel-badge panel-badge--acc">супер-админ</span>
                  ) : (
                    <span className="panel-badge">админ</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    {/* view-as: только на обычного админа (не на себя, не на владельца) */}
                    {canViewAs && a.role === 'admin' && !a.isSelf && !a.isProtected ? (
                      <button
                        type="button"
                        className="panel-btn"
                        onClick={() => enterViewAs(a.id)}
                        disabled={busyId === a.id}
                        title="Открыть панель этого админа в режиме просмотра"
                      >
                        {busyId === a.id ? '…' : '👁 Войти как'}
                      </button>
                    ) : null}
                    {a.isProtected ? (
                      <span className="panel-badge" style={{ alignSelf: 'center' }}>🔒 Владелец</span>
                    ) : a.role === 'admin' ? (
                      <button type="button" className="panel-btn" onClick={() => setRoleFor(a)}>
                        Сменить роль
                      </button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="panel-muted" style={{ marginTop: 12, fontSize: '0.85rem' }}>
        Новый админ назначается сменой роли существующего пользователя (Ученики или
        Кураторы → «Сменить роль» → Админ). Понизить админа можно здесь же.
      </p>

      {roleFor ? (
        <RoleModal
          curator={toCuratorRow(roleFor)}
          isSuperAdmin
          cities={cities}
          onClose={() => setRoleFor(null)}
        />
      ) : null}
    </>
  )
}
