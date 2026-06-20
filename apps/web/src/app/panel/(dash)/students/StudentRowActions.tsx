'use client'

import { useState } from 'react'
import type { PanelStudentRow } from '@/app/api/panel/students/route'

export interface Curator {
  id: string
  name: string | null
  role: string | null
}

type Mode = null | 'menu' | 'role' | 'curator' | 'delete'

const ROLE_LABEL: Record<string, string> = {
  student: 'Ученик',
  curator: 'Куратор',
  admin: 'Админ',
}

/**
 * Действия над учеником: роль / куратор / удаление.
 * Все подтверждения — собственные инлайн-модалки (без confirm/alert).
 */
export function StudentRowActions({
  student,
  curators,
  onDone,
  onError,
}: {
  student: PanelStudentRow
  curators: Curator[]
  onDone: (msg: string) => void
  onError: (msg: string) => void
}) {
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)
  const [roleVal, setRoleVal] = useState('student')
  const [curatorVal, setCuratorVal] = useState(student.curatorId ?? '')

  const close = () => {
    if (!busy) setMode(null)
  }

  const post = async (url: string, body: Record<string, unknown>, okMsg: string) => {
    setBusy(true)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) throw new Error(json.error || 'Ошибка')
      setMode(null)
      onDone(okMsg)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Ошибка')
    } finally {
      setBusy(false)
    }
  }

  const name = student.fullName || 'ученика'

  return (
    <>
      <button type="button" className="panel-btn" onClick={() => setMode(mode === 'menu' ? null : 'menu')}>
        ⋯
      </button>

      {mode === 'menu' && (
        <Overlay onClose={close}>
          <div className="panel-section-title">{student.fullName || 'Ученик'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button type="button" className="panel-btn" onClick={() => setMode('role')}>
              Сменить роль
            </button>
            <button type="button" className="panel-btn" onClick={() => setMode('curator')}>
              Назначить куратора
            </button>
            <button
              type="button"
              className="panel-btn panel-btn--danger"
              disabled={student.isProtected}
              onClick={() => setMode('delete')}
            >
              {student.isProtected ? 'Защищён' : 'Удалить'}
            </button>
            <button type="button" className="panel-btn" onClick={close}>Закрыть</button>
          </div>
        </Overlay>
      )}

      {mode === 'role' && (
        <Overlay onClose={close}>
          <div className="panel-section-title">Роль: {name}</div>
          <select className="panel-select" value={roleVal} onChange={(e) => setRoleVal(e.target.value)} style={{ marginBottom: 14 }}>
            {Object.entries(ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <Actions
            busy={busy}
            confirmLabel="Сменить"
            onCancel={() => setMode('menu')}
            onConfirm={() => post('/api/panel/actions/role', { userId: student.id, role: roleVal }, 'Роль изменена')}
          />
        </Overlay>
      )}

      {mode === 'curator' && (
        <Overlay onClose={close}>
          <div className="panel-section-title">Куратор: {name}</div>
          <select className="panel-select" value={curatorVal} onChange={(e) => setCuratorVal(e.target.value)} style={{ marginBottom: 14 }}>
            <option value="">— без куратора —</option>
            {curators.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name || 'Без имени'}{c.role !== 'curator' ? ` (${ROLE_LABEL[c.role ?? ''] ?? c.role})` : ''}
              </option>
            ))}
          </select>
          <Actions
            busy={busy}
            confirmLabel="Назначить"
            onCancel={() => setMode('menu')}
            onConfirm={() => post('/api/panel/actions/transfer', { userId: student.id, curatorId: curatorVal || null }, 'Куратор обновлён')}
          />
        </Overlay>
      )}

      {mode === 'delete' && (
        <Overlay onClose={close}>
          <div className="panel-section-title">Удалить {name}?</div>
          <p className="panel-muted" style={{ marginBottom: 16 }}>
            Профиль и весь прогресс будут удалены без возможности восстановления.
          </p>
          <Actions
            busy={busy}
            danger
            confirmLabel="Удалить навсегда"
            onCancel={() => setMode('menu')}
            onConfirm={() => post('/api/panel/actions/delete', { userId: student.id }, 'Ученик удалён')}
          />
        </Overlay>
      )}
    </>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,22,28,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="panel-card"
        style={{ width: '100%', maxWidth: 360, textAlign: 'left', boxShadow: '0 24px 60px rgba(20,22,28,0.25)' }}
      >
        {children}
      </div>
    </div>
  )
}

function Actions({
  busy,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  busy: boolean
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
      <button type="button" className="panel-btn" onClick={onCancel} disabled={busy}>Назад</button>
      <button
        type="button"
        className={danger ? 'panel-btn panel-btn--danger' : 'panel-btn panel-btn--primary'}
        onClick={onConfirm}
        disabled={busy}
      >
        {busy ? '…' : confirmLabel}
      </button>
    </div>
  )
}
