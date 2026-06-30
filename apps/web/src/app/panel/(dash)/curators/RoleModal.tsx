'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CuratorRow } from './types'

const ROLE_LABEL: Record<string, string> = {
  student: 'Ученик',
  curator: 'Куратор',
  city_leader: 'Лидер города',
  admin: 'Администратор',
}

/**
 * Смена роли куратора/лидера/админа: student | curator | city_leader | admin.
 * Для «лидера города» обязателен город (дефолт — текущий город цели).
 * POST /api/panel/actions/role.
 */
export function RoleModal({
  curator,
  isSuperAdmin,
  cities = [],
  onClose,
}: {
  curator: CuratorRow
  isSuperAdmin: boolean
  cities?: { id: number; name: string }[]
  onClose: () => void
}) {
  const router = useRouter()
  // Назначать/снимать роль «администратор» может только супер-админ.
  const options = (['student', 'curator', 'city_leader', 'admin'] as const).filter(
    (r) => r !== curator.role && (isSuperAdmin || r !== 'admin'),
  )
  // Дефолт — повышение под распространённый сценарий (куратор → лидер города).
  const preferred = curator.role === 'curator' ? 'city_leader' : 'curator'
  const [role, setRole] = useState<string>(
    options.includes(preferred as (typeof options)[number]) ? preferred : options[0],
  )
  const [cityId, setCityId] = useState<string>(curator.cityId ? String(curator.cityId) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needCity = role === 'city_leader'

  const submit = async () => {
    if (needCity && !cityId) {
      setError('Для лидера города выберите город')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: curator.id,
          role,
          cityId: needCity && cityId ? Number(cityId) : undefined,
        }),
      })
      const b = await res.json().catch(() => ({}))
      if (!res.ok || !b.ok) throw new Error(b.error || 'Не удалось сменить роль')
      onClose()
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка')
      setBusy(false)
    }
  }

  // Понижение до ученика — его ученики будут отвязаны (curator_id обнулится).
  const orphanWarn = role === 'student' && curator.studentsCount > 0

  return (
    <div
      className="panel-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.4)', padding: 16 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="panel-card" style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel-section-title">Сменить роль</div>
        <div className="panel-muted" style={{ fontSize: '0.88rem' }}>
          {curator.name ?? curator.nick ?? curator.id} — сейчас {ROLE_LABEL[curator.role] ?? curator.role}
        </div>
        <select className="panel-select" value={role} onChange={(e) => setRole(e.target.value)}>
          {options.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
        {needCity ? (
          <select className="panel-select" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">Город (обязательно)</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {orphanWarn ? (
          <div style={{ fontSize: '0.85rem', color: 'var(--pl-warn)' }}>
            У него {curator.studentsCount} учеников — при понижении до ученика они будут отвязаны (останутся без куратора). Переназначь их другому куратору.
          </div>
        ) : null}
        {error ? (
          <div style={{ color: 'var(--pl-err)', fontSize: '0.85rem' }}>{error}</div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="panel-btn" onClick={onClose} disabled={busy}>
            Отмена
          </button>
          <button type="button" className="panel-btn panel-btn--primary" onClick={submit} disabled={busy}>
            {busy ? '…' : 'Сменить'}
          </button>
        </div>
      </div>
    </div>
  )
}
