'use client'

import { useState } from 'react'

/**
 * Баннер режима view-as: «Вы смотрите как {имя} ({роль}) · Выйти».
 * Виден super_admin'у, когда активна cookie-наложение view-as.
 */
export function ViewAsBanner({ name, role }: { name: string | null; role: string }) {
  const [busy, setBusy] = useState(false)

  const roleLabel = role === 'curator' ? 'куратор' : role === 'admin' ? 'админ' : role

  const exit = async () => {
    setBusy(true)
    try {
      await fetch('/api/panel/view-as/exit', { method: 'POST' })
    } finally {
      // Полная перезагрузка — серверные компоненты перечитают вернувшуюся сессию.
      window.location.href = '/panel'
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        background: '#7c3aed',
        color: '#fff',
        padding: '10px 16px',
        fontSize: '0.9rem',
        fontWeight: 600,
      }}
    >
      <span>
        👁 Вы смотрите панель как <strong>{name ?? 'без имени'}</strong> ({roleLabel}) — режим просмотра
      </span>
      <button
        type="button"
        onClick={exit}
        disabled={busy}
        style={{
          background: 'rgba(255,255,255,0.18)',
          color: '#fff',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: 8,
          padding: '6px 14px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        {busy ? '…' : 'Выйти из просмотра'}
      </button>
    </div>
  )
}
