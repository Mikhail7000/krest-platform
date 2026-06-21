'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CuratorRow } from './types'

const ROLE_LABEL: Record<string, string> = {
  student: 'Ученик',
  curator: 'Куратор',
  admin: 'Администратор',
}

/**
 * Смена роли куратора/админа: curator ↔ admin ↔ student.
 * POST /api/panel/actions/role (тот же бэкенд, что и на странице учеников).
 */
export function RoleModal({
  curator,
  isSuperAdmin,
  onClose,
}: {
  curator: CuratorRow
  isSuperAdmin: boolean
  onClose: () => void
}) {
  const router = useRouter()
  // Назначать/снимать роль «администратор» может только супер-админ.
  const options = (['student', 'curator', 'admin'] as const).filter(
    (r) => r !== curator.role && (isSuperAdmin || r !== 'admin'),
  )
  // Дефолт — не разрушительная роль (повышение), а не понижение до ученика.
  const preferred = curator.role === 'curator' ? 'admin' : 'curator'
  const [role, setRole] = useState<string>(
    options.includes(preferred as (typeof options)[number]) ? preferred : options[0],
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/panel/actions/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: curator.id, role }),
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
